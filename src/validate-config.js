const config = require("../agent-config.json");
const { agentImports } = require("./agent");

function panic(msg) {
  console.error('\x1b[31m', 'ERROR:', '\x1b[0m', msg);
  process.exit(1);
}

function agentName(agent) {
  return `${agent.name}:${agent.agentType}`;
}

function agentErr(agent, msg) {
  return `${agentName(agent)} ${msg}`;
}

const validateConfig = async (agentMap) => {
  const devAbbrev = config["developerAbbreviation"];
  if (devAbbrev === undefined) {
    panic("developerAbbreviation not defined!");
  }

  const protoName = config["protocolName"];
  if (protoName === undefined) {
    panic("protocolName not defined!");
  }

  const protoAbbrev = config["protocolAbbreviation"];
  if (protoAbbrev === undefined) {
    panic("protocolAbbreviation not defined!");
  }

  const agents = config["agents"];
  if (agents === undefined) {
    panic("agents not defined!");
  }

  let modProms = [];
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];

    if (agent["agentType"] === undefined) {
      panic(`Agent ${i} has no type!`);
    }

    if (agent["name"] === undefined) {
      panic(`Agent ${i} has no name!`);
    }

    if (agent["contracts"] === undefined) {
      panic(agentErr(agent, `has no contracts!`));
    }

    const modProm = agentMap.get(agent.agentType);
    if (modProm === undefined) {
      panic(agentErr(agent, `module not found!`));
    }
    modProms.push(modProm);
  }

  const agentMods = await Promise.all(modProms);
  for (let i = 0; i < agentMods.length; i++) {
    const agent = agents[i];
    const mod = agentMods[i];

    console.log(`validating config for ${agentName(agent)}`);

    const agentConfig = {
      ...agent,
      protoName,
      protoAbbrev,
      devAbbrev,
    };

    if (mod["validateConfig"] === undefined) {
      continue;
    }

    const { ok, errMsg } = mod.validateConfig(agentConfig);
    if (!ok) {
      panic(agentErr(agent, `in config\n  - ${errMsg}`));
    }
  }
};

const main = async () => {
  const agentMap = new Map();
  for (let i = 0; i < agentImports.length; i++) {
    const imp = agentImports[i];
    agentMap.set(imp.name, imp.agent);
  }

  await validateConfig(agentMap);
  console.log("Config validated successfully");
};

main();
