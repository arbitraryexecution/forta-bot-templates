const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

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
