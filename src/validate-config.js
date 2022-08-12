const config = require('../bot-config.json');
const { botImports } = require('./agent');
const { isFilledString, isObject, isEmptyObject } = require('./utils');

function errorMsg(msg) {
  console.error('\x1b[31m', 'ERROR:', '\x1b[0m', msg);
}

function panic(msg) {
  errorMsg(msg);
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
    gatherMode,
    bots,
  } = config;

  if (!isFilledString(developerAbbreviation)) {
    panic("developerAbbreviation not defined!");
  }

  if (!isFilledString(protocolName)) {
    panic("protocolName not defined!");
  }

  if (!isFilledString(protocolAbbreviation)) {
    panic("protocolAbbreviation not defined!");
  }

  if (gatherMode !== "any" && gatherMode !== "all") {
    panic("gatherMode must be any or all");
  }

  if (!isObject(bots) || isEmptyObject(bots)) {
    panic("bots must be defined and contain at least 1 bot!");
  }

  const modProms = [];
  for (let i = 0; i < bots.length; i += 1) {
    const bot = bots[i];

    if (bot.botType === undefined) {
      panic(`Bot ${i} has no type!`);
    }

    if (bot.name === undefined) {
      panic(`Bot ${i} has no name!`);
    }

    if (bot.contracts === undefined) {
      panic(botErr(bot, "has no contracts!"));
    }

    const modProm = botMap.get(bot.botType);
    if (modProm === undefined) {
      panic(botErr(bot, "module not found!"));
    }
    modProms.push(modProm);
  }

  let isValid = true;
  const botMods = await Promise.all(modProms);
  for (let i = 0; i < botMods.length; i += 1) {
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
      // eslint-disable-next-line no-continue
      continue;
    }

    const { ok, errMsg } = mod.validateConfig(botConfig);
    if (!ok) {
      isValid = false;
      errorMsg(botErr(bot, `in config\n  - ${errMsg}\n`));
    }
  }

  return isValid;
};

const main = async () => {
  const botMap = new Map();
  for (let i = 0; i < botImports.length; i += 1) {
    const imp = botImports[i];
    botMap.set(imp.name, imp.bot);
  }

  const isValid = await validateConfig(botMap);
  if (isValid) {
    console.log("Config validated successfully");
  } else {
    panic("Config validation failed!");
  }
};

main();
