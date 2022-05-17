const botImports = [
  {name: 'account-balance',           bot: require('./account-balance/agent')},
  {name: 'address-watch',             bot: require('./address-watch/agent')},
  {name: 'admin-events',              bot: require('./admin-events/agent')},
  {name: 'contract-variable-monitor', bot: require('./contract-variable-monitor/agent')},
  {name: 'gnosis-safe-multisig',      bot: require('./gnosis-safe-multisig/agent')},
  {name: 'governance',                bot: require('./governance/agent')},
  {name: 'monitor-function-calls',    bot: require('./monitor-function-calls/agent')},
  {name: 'new-contract-interaction',  bot: require('./new-contract-interaction/agent')},
  {name: 'tornado-cash-monitor',      bot: require('./tornado-cash-monitor/agent')},
  {name: 'transaction-failure-count', bot: require('./transaction-failure-count/agent')}
];

let botStates = [];
const botMap = new Map();
const config = require('../bot-config.json');

async function generateAllBots(_config) {
  let modProms = [];
  let modNames = [];
  for (let i = 0; i < botImports.length; i++) {
    const imp = botImports[i];
    modProms.push(imp.bot);
    modNames.push(imp.name);
  }

  await Promise.all(modProms).then((data) => {
    for (let i = 0; i < data.length; i++) {
      const module = data[i];
      const name = modNames[i];
      botMap.set(name, module);
    }
  });

  let botConfigs = [];
  for (let i = 0; i < _config.bots.length; i++) {
    const _bot = _config.bots[i];

    let bot = {..._bot};
    bot.developerAbbreviation = _config.developerAbbreviation;
    bot.protocolAbbreviation = _config.protocolAbbreviation;
    bot.protocolName = _config.protocolName;
    botConfigs.push(bot);
  }

  return botConfigs;
}

async function initialize() {
  const botConfigs = await generateAllBots(config);

  const botStateProms = botConfigs.map((bot) => {
    const botMod = botMap.get(bot.botType);
    if (botMod["initialize"] === undefined) {
      const botState = {...bot};
      return new Promise(() => {botState});
    }

    return botMod.initialize(bot);
  });

  const results = await Promise.all(botStateProms);
  results.forEach((result) => botStates.push(result));
}

function handleAllTransactions(_botMap, _botStates) {
  return async function handleTransaction(txEvent) {
    const findProms = _botStates.map((bot) => {
      const botMod = _botMap.get(bot.botType);
      if (botMod["handleTransaction"] === undefined) {
        return;
      }
      return botMod.handleTransaction(bot, txEvent);
    });

    let findings = [];
    let findArrs = await Promise.all(findProms);
    for (let i = 0; i < findArrs.length; i++) {
      findings.push(...findArrs[i]);
    }
    return findings;
  }
}

function handleAllBlocks(_botMap, _botStates) {
  return async function handleBlock(blockEvent) {
    const findProms = _botStates.map((bot) => {
      const botMod = _botMap.get(bot.botType);
      if (botMod["handleBlock"] === undefined) {
        return;
      }
      return botMod.handleBlock(bot, blockEvent);
    });

    findProms = findProms.filter((prom) => prom !== undefined);

    let findings = [];
    let findArrs = await Promise.all(findProms);
    for (let i = 0; i < findArrs.length; i++) {
      findings.push(...findArrs[i]);
    }

    return findings;
  }
}

module.exports = {
  botImports,
  handleAllBlocks,
  handleBlock: handleAllBlocks(botMap, botStates),
  handleAllTransactions,
  handleTransaction: handleAllTransactions(botMap, botStates),
  initialize,
};
