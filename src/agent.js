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

const config = require('../bot-config.json');

const botStates = {};
const botMap = new Map();

async function generateAllBots(_config, _botMap) {
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
      _botMap.set(name, module);
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

  Bots can have block handlers, transaction handlers, or both

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
    - if there are block handlers but no cached results
        (i.e. not all block handlers returned findings), return []
    - if all bots return findings, cache that for the tx handlers
  for all bots with tx handlers:
    - run the handlers, aggregate the results
    - if there are no block handlers, and all bots have tx findings, return the findings
    - if there are block handlers, and all bots have tx findings, return the findings
*/

function initializeBots(_config, _botMap, _botStates) {
  return async function initialize() {
    const botConfigs = await generateAllBots(_config, _botMap);

    /* eslint-disable no-param-reassign */
    _botStates.gatherMode = _config.gatherMode;
    _botStates.txHandlerCount = 0;
    _botStates.blockHandlerCount = 0;
    _botStates.cachedResults = {};
    _botStates.bots = [];
    /* eslint-enable no-param-reassign */

    const botStateProms = botConfigs.map((bot) => {
      const botMod = _botMap.get(bot.botType);
      /* eslint-disable no-param-reassign */
      if (botMod.handleTransaction !== undefined) {
        _botStates.txHandlerCount += 1;
      }
      if (botMod.handleBlock !== undefined) {
        _botStates.blockHandlerCount += 1;
      }
      /* eslint-enable no-param-reassign */

      if (botMod.initialize === undefined) {
        const botState = { ...bot };
        return new Promise(() => botState);
      }

      const prom = botMod.initialize(bot);
      return prom;
    });

    const results = await Promise.all(botStateProms);
    results.forEach((result) => _botStates.bots.push(result));
  };
}

function handleAllBlocks(_botMap, _botStates) {
  return async function handleBlock(blockEvent) {
    if (_botStates.blockHandlerCount === 0) {
      return [];
    }

    const findProms = [];
    for (let i = 0; i < _botStates.bots.length; i += 1) {
      const bot = _botStates.bots[i];
      const botMod = _botMap.get(bot.botType);
      if (botMod.handleBlock !== undefined) {
        findProms.push(botMod.handleBlock(bot, blockEvent));
      }
    }

    const findings = await Promise.all(findProms);

    if (_botStates.gatherMode === 'any') {
      return findings.flat();
    }

    // At this point, we're handling the nasty edge cases of all
    const allFindings = findings.every((finding) => finding.length > 0);

    if (!allFindings) {
      return [];
    }

    if (_botStates.txHandlerCount === 0) {
      return findings.flat();
    }

    // eslint-disable-next-line no-param-reassign
    _botStates.cachedResults[blockEvent.block.hash] = {
      txTotal: blockEvent.transactions.length,
      txDone: 0,
      blockFindings: findings.flat(),
    };
    return [];
  };
}

function handleAllTransactions(_botMap, _botStates) {
  return async function handleTransaction(txEvent) {
    // We can't have any findings if we have no handlers!
    if (_botStates.txHandlerCount === 0) {
      return [];
    }

    const blockHash = txEvent.block.hash;
    const cachedBlock = _botStates.cachedResults[blockHash];

    // if there are block handlers, but they didn't return all positive findings
    if (_botStates.gatherMode === 'all' && _botStates.blockHandlerCount > 0 && cachedBlock === undefined) {
      return [];
    }

    const findProms = [];
    for (let i = 0; i < _botStates.bots.length; i += 1) {
      const bot = _botStates.bots[i];
      const botMod = _botMap.get(bot.botType);
      if (botMod.handleTransaction !== undefined) {
        findProms.push(botMod.handleTransaction(bot, txEvent));
      }
    }
    const findings = await Promise.all(findProms);

    if (_botStates.gatherMode === 'any') {
      return findings.flat();
    }

    // At this point, we're only handling the nasty edge cases of all
    const allFindings = findings.every((finding) => finding.length > 0);

    let blockFindings = [];
    if (_botStates.blockHandlerCount > 0) {
      // Assumption: That the JS async scheduler switches threadlets on a timer in addition to
      // explicit yields, so without this, we *may* wind up in a race condition where we
      // delete the cachedResults twice if we're *very* unlucky
      blockFindings = cachedBlock.blockFindings;

      // if we've finished all the transactions for a block, delete the cachedResults
      /* eslint-disable no-param-reassign */
      // eslint-disable-next-line max-len
      if (_botStates.cachedResults[blockHash].txDone + 1 >= _botStates.cachedResults[blockHash].txTotal) {
        delete _botStates.cachedResults[blockHash];
      } else {
        _botStates.cachedResults[blockHash].txDone += 1;
      }
      /* eslint-enable no-param-reassign */
    }

    // If we didn't see enough tx findings
    if (!allFindings) {
      return [];
    }

    return [...blockFindings, ...findings.flat()];
  };
}

module.exports = {
  initializeBots,
  initialize: initializeBots(config, botMap, botStates),
  handleAllBlocks,
  handleBlock: handleAllBlocks(botMap, botStates),
  handleAllTransactions,
  handleTransaction: handleAllTransactions(botMap, botStates),
  botImports,
};
