const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const { getInternalAbi } = require('../utils');

const TORNADO_CASH_ADDRESSES = [
  '0x722122dF12D4e14e13Ac3b6895a86e84145b6967',
];

function createAlert(
  monitoredAddress,
  name,
  suspiciousAddress,
  developerAbbrev,
  protocolName,
  protocolAbbrev,
  type,
  severity,
) {
  return Finding.fromObject({
    name: `${protocolName} Tornado Cash Monitor`,
    description: `The ${name} address (${monitoredAddress}) was involved in a transaction`
      + ` with an address ${suspiciousAddress} that has previously interacted with Tornado Cash`,
    alertId: `${developerAbbrev}-${protocolAbbrev}-TORNADO-CASH-MONITOR`,
    type,
    severity,
    metadata: {
      monitoredAddress,
      name,
      suspiciousAddress,
      tornadoCashContractAddresses: TORNADO_CASH_ADDRESSES.join(','),
    },
  });
}

const initialize = async (config) => {
	let agentState = {...config};

	agentState.developerAbbreviation = config.developerAbbreviation;
	agentState.protocolName = config.protocolName;
	agentState.protocolAbbreviation = config.protocolAbbreviation;
	agentState.observationIntervalInBlocks = config.observationIntervalInBlocks;

	const abi = getInternalAbi(config.agentType, "TornadoProxy.json");
	agentState.iface = new ethers.utils.Interface(abi);

	const addressNames = Object.keys(config.contracts);
	if (addressNames.length === 0) {
		throw new Error('Must supply at least one address to watch');
	}

	agentState.addressesToMonitor = [];
	addressNames.forEach((addressName) => {
		const info = {
			name: addressName,
			address: config.contracts[addressName].address,
			type: config.contracts[addressName].tornado.type,
			severity: config.contracts[addressName].tornado.severity,
		};

		agentState.addressesToMonitor.push(info);
	});

	// create an object to hold addresses that have been identified as having interacted with a
	// Tornado Cash Proxy
	agentState.suspiciousAddresses = {};

	return agentState;
};

const handleTransaction = async (agentState, txEvent) => {
	const findings = [];

	// check to see if the given transaction includes deposit/withdraw calls from a tornado cash
	// proxy
	let addressesOfInterest = TORNADO_CASH_ADDRESSES.map((address) => {
		const filterResult = txEvent.filterFunction(
			agentState.iface.format(ethers.utils.FormatTypes.full),
			address,
		);

		if (filterResult.length > 0) {
			return txEvent.from;
		}

		return '';
	});

	// filter out any empty strings
	addressesOfInterest = addressesOfInterest.filter((address) => address !== '');

	// for each address found to have interacted with a tornado cash proxy, add it to our
	// suspiciousAddresses object and instantiate a number of blocks to watch the address for; if
	// an address is already present in suspiciousAddresses then simply restart its block timer
	addressesOfInterest.forEach((address) => {
		// eslint-disable-next-line no-param-reassign
		agentState.suspiciousAddresses[address] = { blockAdded: txEvent.blockNumber, };
	});

	// iterate over the list of suspiciousAddresses and check to see if any address can be removed
	const addressesToRemove = [];
	Object.keys(agentState.suspiciousAddresses).forEach((address) => {
		const currBlock = txEvent.blockNumber;
		const { blockAdded } = agentState.suspiciousAddresses[address];
		if ((currBlock - blockAdded) > agentState.observationIntervalInBlocks) {
			// block is older than observationIntervalInBlocks and can be removed from
			// suspicousAddresses
			addressesToRemove.push(address);
		}
	});

	// eslint-disable-next-line no-param-reassign
	addressesToRemove.forEach((address) => delete agentState.suspiciousAddresses[address]);

	// now check to see if the higher level list of addresses in txEvent contains at least one
	// address from suspiciousAddresses and one address from the addressesToMonitor
	Object.keys(agentState.suspiciousAddresses).forEach((address) => {
		agentState.addressesToMonitor.forEach((addressInfo) => {
			const { address: monitoredAddress } = addressInfo;
			if (txEvent.addresses[address] !== undefined && txEvent.addresses[monitoredAddress] !== undefined) {

				findings.push(createAlert(
					monitoredAddress,
					addressInfo.name,
					address,
					agentState.developerAbbreviation,
					agentState.protocolName,
					agentState.protocolAbbreviation,
					FindingType[addressInfo.type],
					FindingSeverity[addressInfo.severity],
				));
			}
		});
	});

	return findings;
};

module.exports = {
  TORNADO_CASH_ADDRESSES,
  initialize,
  handleTransaction,
};
