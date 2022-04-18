const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

let agentImports = [
	{name: 'account-balance',           mod: import('../account-balance/src/agent.js')},
	{name: 'address-watch',             mod: import('../address-watch/src/agent.js')},
	{name: 'admin-events',              mod: import('../admin-events/src/agent.js')},
	{name: 'contract-variable-monitor', mod: import('../contract-variable-monitor/src/agent.js')},
	{name: 'gnosis-safe-multisig',      mod: import('../gnosis-safe-multisig/src/agent.js')},
	{name: 'governance',                mod: import('../governance/src/agent.js')},
	{name: 'monitor-function-calls',    mod: import('../monitor-function-calls/src/agent.js')},
	{name: 'new-contract-interaction',  mod: import('../new-contract-interaction/src/agent.js')},
	{name: 'tornado-cash-monitor',      mod: import('../tornado-cash-monitor/src/agent.js')},
	{name: 'transaction-failure-count', mod: import('../transaction-failure-count/src/agent.js')}
];

let agentStates = [];
const agentMap = new Map();
const config = require('../agent-config.json');

async function generateAllAgents(_config) {
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

	return agentConfigs;
}

async function initialize() {
	let agentConfigs = await generateAllAgents(config);

	for (let i = 0; i < agentConfigs.length; i++) {
		const agent = agentConfigs[i];

		const agentMod = agentMap.get(agent.agentType);
		console.log(agent.agentType);
		if (agentMod["initialize"] === undefined) {
			continue;
		}

		const agentStateProm = agentMod.initialize(agent);
		await agentStateProm.then((agentState) => {
			agentState.agentType = agent.agentType;
			agentStates.push(agentState);
		});
	}
}

function handleAllTransactions(_agentMap, _agentStates) {
	return async function handleTransaction(txEvent) {
		let find_prom = [];
		for (let i = 0; i < _agentStates.length; i++) {
			const agent = _agentStates[i];

			const agentMod = _agentMap.get(agent.agentType);
			if (agentMod["handleTransaction"] === undefined) {
				continue;
			}

			let ret = agentMod.handleTransaction(agent, txEvent);
			find_prom.push(ret);
		}

		let findings = [];
		await Promise.all(find_prom).then((data) => {
			for (let i = 0; i < data.length; i++) {
				findings.concat(data[i]);
			}
		}).catch((err) => {
			console.log(err);
			throw(err);
		});
		return findings;
	}
}

function handleAllBlocks(_agentMap, _agentStates) {
	return async function handleBlock(blockEvent) {
		let find_prom = [];
		for (let i = 0; i < _agentStates.length; i++) {
			const agent = _agentStates[i];

			const agentMod = _agentMap.get(agent.agentType);
			if (agentMod["handleBlock"] === undefined) {
				continue;
			}

			let ret = agentMod.handleBlock(agent, blockEvent);
			find_prom.push(ret);
		}

		let findings = [];
		await Promise.all(find_prom).then((data) => {
			for (let i = 0; i < data.length; i++) {
				findings.concat(data[i]);
			}
		}).catch((err) => {
			console.log(err);
			throw(err);
		});
		return findings;
	}
}

module.exports = {
  initialize,
  handleAllTransactions,
  handleTransaction: handleAllTransactions(agentMap, agentStates),
  handleAllBlocks,
  handleBlock: handleAllBlocks(agentMap, agentStates),
};
