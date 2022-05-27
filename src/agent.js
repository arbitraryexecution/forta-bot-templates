/* eslint-disable global-require */
const botImports = [
  { name: 'account-balance', bot: require('./account-balance/agent') },
  { name: 'address-watch', bot: require('./address-watch/agent') },
  { name: 'monitor-events', bot: require('./monitor-events/agent') },
  { name: 'contract-variable-monitor', bot: require('./contract-variable-monitor/agent') },
  { name: 'gnosis-safe-multisig', bot: require('./gnosis-safe-multisig/agent') },
  { name: 'governance', bot: require('./governance/agent') },
  { name: 'monitor-function-calls', bot: require('./monitor-function-calls/agent') },
  { name: 'new-contract-interaction', bot: require('./new-contract-interaction/agent') },
  { name: 'tornado-cash-monitor', bot: require('./tornado-cash-monitor/agent') },
  { name: 'transaction-failure-count', bot: require('./transaction-failure-count/agent') },
];
/* eslint-enable global-require */

const botStates = [];
const botMap = new Map();
const config = require('../bot-config.json');

let txHandlerCount = 0;
let blockHandlerCount = 0;
let gatherMode = 'any';
const cachedResults = {};

async function generateAllBots(_config) {
  const modProms = [];
  const modNames = [];
  for (let i = 0; i < botImports.length; i += 1) {
    const imp = botImports[i];
    modProms.push(imp.bot);
    modNames.push(imp.name);
  }

  await Promise.all(modProms).then((data) => {
    for (let i = 0; i < data.length; i += 1) {
      const module = data[i];
      const name = modNames[i];
      botMap.set(name, module);
    }
  });

  const botConfigs = [];
  for (let i = 0; i < _config.bots.length; i += 1) {
    const bot = { ..._config.bots[i] };
    bot.developerAbbreviation = _config.developerAbbreviation;
    bot.protocolAbbreviation = _config.protocolAbbreviation;
    bot.protocolName = _config.protocolName;
    botConfigs.push(bot);
  }

  return botConfigs;
}

/*
  gatherType "all" is weird. A quick rundown:

  Inbound blocks look like this:
  HandleBlock
  - HandleTransaction
  - HandleTransaction
  - HandleTransaction
  - HandleTransaction

  Notable outbound cases:

  for all positive block findings, where we only have block handling bots:
    HandleBlock -> [Finding, Finding, Finding]
    - HandleTransaction -> []

  for all positive tx findings, where we only have tx handling bots:
    HandleBlock -> []
    - HandleTransaction -> [Finding, Finding, Finding]

  for all positive tx and block findings:
    HandleBlock -> []
    - HandleTransaction -> [...blockFindings[Finding], ...txFindings[Finding, Finding]]

  for all positive block findings, some/no tx findings:
    HandleBlock -> []
    - HandleTransaction -> []

  for only some positive block findings, all/some/no tx findings:
    HandleBlock -> []
    - HandleTransaction -> []

  Bots can have a block handler, a transaction handler, or both

  if there are only bots with block handlers:
    - run the block handlers, aggregate the results
    - if all bots return findings, return the findings
    - else return []
  if there are only bots with tx handlers:
    - run the tx handlers, aggregate the results
    - if all bots return findings, return the findings
    - else return []

  if you've got mixed tx and block handlers:
  for all bots with block handlers:
    - run the handlers, aggregate the results
    - if all bots return findings, cache that for the tx handlers
  for all bots with tx handlers:
    - run the handlers, aggregate the results
    - if there are no block handlers, and all bots have tx findings, return the findings
    - if there are block handlers, and all bots have tx findings, return the findings
*/

async function initialize() {
  const botConfigs = await generateAllBots(config);
  gatherMode = config.gatherMode;

  const botStateProms = botConfigs.map((bot) => {
    const botMod = botMap.get(bot.botType);
    if (botMod.handleTransaction !== undefined) {
      txHandlerCount += 1;
    }
    if (botMod.handleBlock !== undefined) {
      blockHandlerCount += 1;
    }

    if (botMod.initialize === undefined) {
      const botState = { ...bot };
      return new Promise(() => botState);
    }

    const prom = botMod.initialize(bot);
    return prom;
  });

  const results = await Promise.all(botStateProms);
  results.forEach((result) => botStates.push(result));
}

function handleAllBlocks(_botMap, _botStates) {
  return async function handleBlock(blockEvent) {
    const findProms = [];
    for (let i = 0; i < _botStates.length; i += 1) {
      const bot = _botStates[i];
      const botMod = _botMap.get(bot.botType);
      if (botMod.handleBlock !== undefined) {
        findProms.push(botMod.handleBlock(bot, blockEvent));
      }
    }
    const findings = await Promise.all(findProms);

    if (gatherMode === 'any') {
      return findings.flat();
    }

    // At this point, we're handling the nasty edge cases of all

    let allEvents = true;
    for (let i = 0; i < findings.length; i += 1) {
      const find = findings[i];
      if (find.length === 0) {
        allEvents = false;
        break;
      }
    }

    if (allEvents && txHandlerCount === 0) {
      return findings.flat();
    }

    cachedResults[blockEvent.hash] = {
      txTotal: blockEvent.transactions,
      txDone: 0,
      blockEvents: findings.flat(),
    };
    return [];
  };
}

function handleAllTransactions(_botMap, _botStates) {
  return async function handleTransaction(txEvent) {
    // We can't have any findings if we have no handlers!
    if (txHandlerCount === 0) {
      return [];
    }

    const blockHash = txEvent.block.hash;
    const cachedBlock = cachedResults[blockHash];

    // if there are block handlers, but they didn't return all positive findings
    if (gatherMode === 'all' && blockHandlerCount > 0 && cachedBlock === undefined) {
      return [];
    }

    const findProms = [];
    for (let i = 0; i < _botStates.length; i += 1) {
      const bot = _botStates[i];
      const botMod = _botMap.get(bot.botType);
      if (botMod.handleTransaction !== undefined) {
        findProms.push(botMod.handleTransaction(bot, txEvent));
      }
    }
    const findings = await Promise.all(findProms);

    if (gatherMode === 'any') {
      return findings.flat();
    }

    // At this point, we're only handling the nasty edge cases of all
    let allEvents = true;
    for (let i = 0; i < findings.length; i += 1) {
      const find = findings[i];
      if (find.length === 0) {
        allEvents = false;
        break;
      }
    }

    let blockEvents = [];
    if (blockHandlerCount > 0) {
      // This is grody. I'm making the assumption that the JS async scheduler
      // switches threadlets on a timer in addition to explicit yields, so without this, we *may*
      // wind up in a race condtion where we delete the cachedResults twice if we're *SUPER* unlucky
      blockEvents = cachedBlock.blockEvents;
      if (cachedResults[blockHash].txDoneCount + 1 >= txHandlerCount) {
        delete cachedResults[blockHash];
      } else {
        cachedResults[blockHash].txDoneCount += 1;
      }
    }

    // If we didn't see enough tx findings
    if (!allEvents) {
      return [];
    }

    return [...blockEvents, ...findings.flat()];
  };
}

module.exports = {
  botImports,
  handleAllBlocks,
  handleBlock: handleAllBlocks(botMap, botStates),
  handleAllTransactions,
  handleTransaction: handleAllTransactions(botMap, botStates),
  initialize,
};
