const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

let agentImports = [
	{name: 'account-balance',           mod: import('../account-balance/src/agent.js')},
	{name: 'address-watch',             mod: import('../address-watch/src/agent.js')},
	{name: 'admin-events',              mod: import('../admin-events/src/agent.js')},
	{name: 'contract-variable',         mod: import('../contract-variable-monitor/src/agent.js')},
	{name: 'gnosis-safe-multisig',      mod: import('../gnosis-safe-multisig/src/agent.js')},
	{name: 'governance',                mod: import('../governance/src/agent.js')},
	{name: 'monitor-function-calls',    mod: import('../monitor-function-calls/src/agent.js')},
	{name: 'new-contract-interaction',  mod: import('../new-contract-interaction/src/agent.js')},
	{name: 'tornado-cash-monitor',      mod: import('../tornado-cash-monitor/src/agent.js')},
	{name: 'transaction-failure-count', mod: import('../transaction-failure-count/src/agent.js')}
];

let agent_states = [];
const agentMap = new Map();
const config = require('../agent-config.json');

async function generateAllAgents(_config) {
	let mod_proms = [];
	let mod_names = [];
	for (let i = 0; i < agentImports.length; i++) {
		const imp = agentImports[i];
		mod_proms.push(imp.mod);
		mod_names.push(imp.name);
	}

	await Promise.all(mod_proms).then((data) => {
		for (let i = 0; i < data.length; i++) {
			const module = data[i];
			const name = mod_names[i];
			agentMap.set(name, module);
		}
	}).catch((err) => {
		console.log(err);
	});

	let agent_configs = [];
	for (let i = 0; i < _config.agents.length; i++) {
		const _agent = _config.agents[i];

		let agent = {..._agent};
		agent.developerAbbreviation = _config.developerAbbreviation;
		agent.protocolAbbreviation = _config.protocolAbbreviation;
		agent.protocolName = _config.protocolName;
		agent_configs.push(agent);
	}

	return agent_configs;
}

async function initialize() {
	let agent_configs = await generateAllAgents(config);

	for (let i = 0; i < agent_configs.length; i++) {
		const agent = agent_configs[i];

		const agent_module = agentMap.get(agent.agentType);
		const agent_state_prom = agent_module.initialize(agent);
		agent_state_prom.then((agent_state) => {
			agent_state.agentType = agent.agentType;
			agent_states.push(agent_state);
		}).catch((err) => {
			console.log(err);
		});
	}
}

function handleAllTransactions(_agent_map, _agent_states) {
	return async function handleTransaction(txEvent) {
		let findings = [];
		for (let i = 0; i < _agent_states.length; i++) {
			const agent = _agent_states[i];

			const agentMod = _agent_map.get(agent.agentType);
			if (agentMod["handleTransaction"] === undefined) {
				continue;
			}

			let ret = agentMod.handleTransaction(agent, txEvent);
			findings = findings.concat(ret);
		}

		return findings;
	}
}

function handleAllBlocks(_agent_map, _agent_states) {
	return async function handleBlock(blockEvent) {
		let findings = [];
		for (let i = 0; i < _agent_states.length; i++) {
			const agent = _agent_states[i];

			const agentMod = _agent_map.get(agent.agentType);
			if (agentMod["handleBlock"] === undefined) {
				continue;
			}

			let ret = agentMod.handleBlock(agent, blockEvent);
			findings = findings.concat(ret);
		}

		return findings;
	}
}

module.exports = {
  initialize,
  handleAllTransactions,
  handleTransaction: handleAllTransactions(agentMap, agent_states),
  handleAllBlocks,
  handleBlock: handleAllBlocks(agentMap, agent_states),
};
