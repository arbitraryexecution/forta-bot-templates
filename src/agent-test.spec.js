const { agentImports } = require("./agent");

async function generateAllAgents(_config) {
  const agentMap = new Map();
  const testMap = new Map();

  let modAgentProms = [];
  let modTestProms = [];
  let modNames = [];
  for (let i = 0; i < agentImports.length; i++) {
    const imp = agentImports[i];
    modAgentProms.push(imp.agent);
    modTestProms.push(imp.test);
    modNames.push(imp.name);
  }

  await Promise.all(modAgentProms).then((data) => {
    for (let i = 0; i < data.length; i++) {
      const module = data[i];
      const name = modNames[i];
      agentMap.set(name, module);
    }
  });

  await Promise.all(modTestProms).then((data) => {
    for (let i = 0; i < data.length; i++) {
      const test = data[i];
      const name = modNames[i];
      testMap.set(name, test);
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

  return { agentMap, testMap, agentConfigs };
}

const runTests = async () => {
  let testContexts = [];

  const topConfig = require('../agent-config.json');
  const { agentMap, testMap, agentConfigs } = await generateAllAgents(topConfig);

  for (let i = 0; i < agentConfigs.length; i++) {
    const config = agentConfigs[i];
    const test = testMap.get(config.agentType);

    if (test === undefined) {
      throw new Error('Agent ' + config.agentType + ' test not in agentImports');
    }
    if (test == null) {
      continue;
    }

    const agent = agentMap.get(config.agentType);
    if (agent === undefined) {
      throw new Error('Agent ' + config.agentType + ' not in agentImports');
    }

    if (test["tests"] === undefined) {
      continue;
    }

    await test.tests(config, agent);
  };
};

runTests();
