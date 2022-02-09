const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

// load config file
const config = require('../agent-config.json');

// load ABI fragment for tornado proxy contracts
const { abi } = require('../abi/TornadoProxy.json');

const TORNADO_CASH_ADDRESSES = [
  '0x722122dF12D4e14e13Ac3b6895a86e84145b6967',
];

// set up a variable to hold initialization data used in the handler
const initializeData = {};

function createAlert(
  contractAddress,
  contractName,
  suspiciousAddress,
  developerAbbrev,
  protocolName,
  protocolAbbrev,
  type,
  severity,
) {
  return Finding.fromObject({
    name: `${protocolName} Tornado Cash Monitor`,
    description: `The ${contractName} contract (${contractAddress}) was involved in a transaction`
      + ` with an address ${suspiciousAddress} that has previously interacted with Tornado Cash`,
    alertId: `${developerAbbrev}-${protocolAbbrev}-TORNADO-CASH-MONITOR`,
    type,
    severity,
    metadata: {
      contractAddress,
      contractName,
      suspiciousAddress,
      tornadoCashContractAddresses: TORNADO_CASH_ADDRESSES,
    },
  });
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // load configuration data from agent config file
    const {
      developerAbbreviation,
      protocolName,
      protocolAbbreviation,
      observationIntervalInBlocks,
      contracts,
    } = config;

    data.developerAbbreviation = developerAbbreviation;
    data.protocolName = protocolName;
    data.protocolAbbreviation = protocolAbbreviation;
    data.observationIntervalInBlocks = observationIntervalInBlocks;
    data.iface = new ethers.utils.Interface(abi);

    // get the contract names specified in the config
    const contractNames = Object.keys(contracts);
    if (contractNames.length === 0) {
      throw new Error('Must supply at least one contract to watch');
    }

    data.contractsToMonitor = [];
    contractNames.forEach((contractName) => {
      const info = {
        name: contractName,
        address: contracts[contractName].address,
        type: contracts[contractName].type,
        severity: contracts[contractName].severity,
      };

      data.contractsToMonitor.push(info);
    });

    // create an object to hold addresses that have been identified as having interacted with a
    // Tornado Cash Proxy
    data.suspiciousAddresses = {};
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const findings = [];
    const {
      developerAbbreviation,
      protocolName,
      protocolAbbreviation,
      observationIntervalInBlocks,
      iface,
      contractsToMonitor,
    } = data;

    // check to see if the given transaction includes deposit/withdraw calls from a tornado cash
    // proxy
    let addressesOfInterest = TORNADO_CASH_ADDRESSES.map((address) => {
      const filterResult = txEvent.filterFunction(
        iface.format(ethers.utils.FormatTypes.full, address),
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
      data.suspiciousAddresses[address] = {
        blockAdded: txEvent.blockNumber,
      };
    });

    // iterate over the list of suspiciousAddresses and check to see if any address can be removed
    const addressesToRemove = [];
    Object.keys(data.suspiciousAddresses).forEach((address) => {
      const currBlock = txEvent.blockNumber;
      const { blockAdded } = data.suspiciousAddresses[address];
      if ((currBlock - blockAdded) >= observationIntervalInBlocks) {
        // block is older than observationIntervalInBlocks and can be removed from
        // suspicousAddresses
        addressesToRemove.push(address);
      }
    });

    // eslint-disable-next-line no-param-reassign
    addressesToRemove.forEach((address) => delete data.suspiciousAddresses[address]);

    // now check to see if the higher level list of addresses in txEvent contains at least one
    // address from suspiciousAddresses and one address from the contractsToMonitor
    Object.keys(data.suspiciousAddresses).forEach((address) => {
      contractsToMonitor.forEach((contractInfo) => {
        const { address: contractAddress } = contractInfo;
        if (txEvent.addresses[address] !== undefined
            && txEvent.addresses[contractAddress] !== undefined) {
          // generate a finding
          findings.push(createAlert(
            contractAddress,
            contractInfo.name,
            address,
            developerAbbreviation,
            protocolName,
            protocolAbbreviation,
            FindingType[contractInfo.type],
            FindingSeverity[contractInfo.severity],
          ));
        }
      });
    });

    return findings;
  };
}

module.exports = {
  TORNADO_CASH_ADDRESSES,
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createAlert,
};
