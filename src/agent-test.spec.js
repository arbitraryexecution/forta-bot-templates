const { agentImports } = require("./agent");

async function generateAllAgents(_config) {
  const agentMap = new Map();

  let modProms = [];
  let modNames = [];
  for (let i = 0; i < agentImports.length; i++) {
    const imp = agentImports[i];
    modProms.push(imp.mod);
    modNames.push(imp.name);
  }

  await Promise.all(modProms).then((data) => {
    for (let i = 0; i < data.length; i++) {
      const module = data[i];
      const name = modNames[i];
      agentMap.set(name, module);
    }
  });

  let agentConfigs = [];
  for (let i = 0; i < _config.agents.length; i++) {
    const _agent = _config.agents[i];

    let agent = {..._agent};
    agent.developerAbbreviation = _config.developerAbbreviation;
    agent.protocolAbbreviation = _config.protocolAbbreviation;
    agent.protocolName = _config.protocolName;
    agentConfigs.push(agent);
  }

  return { agentMap, agentConfigs };
}

async function initAgents(agentMap, agentConfigs) {
  const agentStateProms = agentConfigs.map((agent) => {
    const agentMod = agentMap.get(agent.agentType);
    if (agentMod["initialize"] === undefined) {
      const agentState = {...agent};
      return new Promise(() => {agentState});
    }

    return agentMod.initialize(agent);
  });

  return await Promise.all(agentStateProms);
}

const config = require('../agent-config.json');
test('check agent configuration file', async () => {
  const { agentMap, agentConfigs } = await generateAllAgents(config);
  const agentStates = await initAgents(agentMap, agentConfigs);
});
