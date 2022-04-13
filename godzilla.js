const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

function importAgent(map, name) {
	map.set(name, require(name));
}

const agentMap = new Map();
importAgent(agentMap, 'account-balance');
importAgent(agentMap, 'address-watch');
importAgent(agentMap, 'admin-events');
importAgent(agentMap, 'contract-variable-monitor');
importAgent(agentMap, 'gnosis-safe-multisig');
importAgent(agentMap, 'governance');
importAgent(agentMap, 'monitor-function-calls');
importAgent(agentMap, 'new-contract-interaction');
importAgent(agentMap, 'tornado-cash-monitor');
importAgent(agentMap, 'transaction-failure-count');

const agents = [];
function generateAllAgents(config) {
	// TODO(cloin): Fill out agents from config
}

const config = require('agent-config.json');
generateAllAgents(config);

function provideInitialize(data) {
	return async function initialize() {

		for agent in agents {
			// TODO(cloin): Fill out agents with Forta data
		}
	}
}

function handleAllTransactions(data) {
	return async function handleTransaction() {
		for agent in agents {
			// TODO(cloin): Process all agents with transactions
		}
	}
}

function handleAllBlocks(data) {
	return async function handleBlock() {
		for agent in agents {
			// TODO(cloin): Process all agents with blocks
		}
	}
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
};
