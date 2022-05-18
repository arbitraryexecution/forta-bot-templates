const config = require('../bot-config.json');
const { botImports } = require('./agent');

function panic(msg) {
  console.error('\x1b[31m', 'ERROR:', '\x1b[0m', msg);
  process.exit(1);
}

function botName(bot) {
  return `${bot.name}:${bot.botType}`;
}

function botErr(bot, msg) {
  return `${botName(bot)} ${msg}`;
}

const validateConfig = async (botMap) => {
  const {
    developerAbbreviation,
    protocolName,
    protocolAbbreviation,
    bots,
  } = config;

  if (developerAbbreviation === undefined) {
    panic('developerAbbreviation not defined!');
  }

  if (protocolName === undefined) {
    panic('protocolName not defined!');
  }

  if (protocolAbbreviation === undefined) {
    panic('protocolAbbreviation not defined!');
  }

  if (bots === undefined) {
    panic('bots not defined!');
  }

  const modProms = [];
  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];

    if (bot.botType === undefined) {
      panic(`Bot ${i} has no type!`);
    }

    if (bot.name === undefined) {
      panic(`Bot ${i} has no name!`);
    }

    if (bot.contracts === undefined) {
      panic(botErr(bot, 'has no contracts!'));
    }

    const modProm = botMap.get(bot.botType);
    if (modProm === undefined) {
      panic(botErr(bot, 'module not found!'));
    }
    modProms.push(modProm);
  }

  const botMods = await Promise.all(modProms);
  for (let i = 0; i < botMods.length; i++) {
    const bot = bots[i];
    const mod = botMods[i];

    console.log(`validating config for ${botName(bot)}`);

    const botConfig = {
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      ...bot,
    };

    if (mod.validateConfig === undefined) {
      continue;
    }

    const { ok, errMsg } = mod.validateConfig(botConfig);
    if (!ok) {
      panic(botErr(bot, `in config\n  - ${errMsg}`));
    }
  }
};

const main = async () => {
  const botMap = new Map();
  for (let i = 0; i < botImports.length; i++) {
    const imp = botImports[i];
    botMap.set(imp.name, imp.bot);
  }

  await validateConfig(botMap);
  console.log('Config validated successfully');
};

main();
