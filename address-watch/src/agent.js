const { Finding, FindingSeverity, FindingType } = require('forta-agent');

const initialize = async (config) => {
	// get list of addresses to watch
	const contractList = Object.values(config.contracts);
	if (contractList.length === 0) {
	  throw new Error('Must supply at least one address to watch');
	}

	const agentState = config;
	return agentState;
};

function createAlert(agentState, address, contractName, type, severity) {
  return Finding.fromObject({
    name: `${agentState.protocolName} Address Watch`,
    description: `Address ${address} (${contractName}) was involved in a transaction`,
    alertId: `${agentState.developerAbbreviation}-${agentState.protocolAbbrev}-ADDRESS-WATCH`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
  });
}

const handleTransaction = async (agentState, txEvent) => {
  const findings = [];
  const txAddrs = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());

  // check if an address in the watchlist was the initiator of the transaction
  contractList.forEach((contract, index) => {
    if (txAddrs.includes(contract.address.toLowerCase())) {
      const params = Object.values(agentState.contracts)[index];
      findings.push(createAlert(agentState, contract.address, params.name, params.watch.type, params.watch.severity));
    }
  });

  return findings;
};

module.exports = {
  initialize,
  handleTransaction,
};
