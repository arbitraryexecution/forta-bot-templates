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

async function initialize() {
  const botConfigs = await generateAllBots(config);

  const botStateProms = botConfigs.map((bot) => {
    const botMod = botMap.get(bot.botType);
    if (botMod.initialize === undefined) {
      const botState = { ...bot };
      return new Promise(() => botState);
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
      if (botMod.handleTransaction === undefined) {
        return [];
      }
      return botMod.handleTransaction(bot, txEvent);
    });
    const findings = (await Promise.all(findProms)).flat();
    return findings;
  };
}

function handleAllBlocks(_botMap, _botStates) {
  return async function handleBlock(blockEvent) {
    const findProms = _botStates.map((bot) => {
      const botMod = _botMap.get(bot.botType);
      if (botMod.handleBlock === undefined) {
        return [];
      }
      return botMod.handleBlock(bot, blockEvent);
    });
    const findings = (await Promise.all(findProms)).flat();
    return findings;
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
