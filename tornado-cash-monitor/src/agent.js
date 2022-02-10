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
      addressList,
    } = config;

    data.developerAbbreviation = developerAbbreviation;
    data.protocolName = protocolName;
    data.protocolAbbreviation = protocolAbbreviation;
    data.observationIntervalInBlocks = observationIntervalInBlocks;
    data.iface = new ethers.utils.Interface(abi);

    // get the address names specified in the config
    const addressNames = Object.keys(addressList);
    if (addressNames.length === 0) {
      throw new Error('Must supply at least one address to watch');
    }

    data.addressesToMonitor = [];
    addressNames.forEach((addressName) => {
      const info = {
        name: addressName,
        address: addressList[addressName].address,
        type: addressList[addressName].type,
        severity: addressList[addressName].severity,
      };

      data.addressesToMonitor.push(info);
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
      addressesToMonitor,
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
      if ((currBlock - blockAdded) > observationIntervalInBlocks) {
        // block is older than observationIntervalInBlocks and can be removed from
        // suspicousAddresses
        addressesToRemove.push(address);
      }
    });

    // eslint-disable-next-line no-param-reassign
    addressesToRemove.forEach((address) => delete data.suspiciousAddresses[address]);

    // now check to see if the higher level list of addresses in txEvent contains at least one
    // address from suspiciousAddresses and one address from the addressesToMonitor
    Object.keys(data.suspiciousAddresses).forEach((address) => {
      addressesToMonitor.forEach((addressInfo) => {
        const { address: monitoredAddress } = addressInfo;
        if (txEvent.addresses[address] !== undefined
            && txEvent.addresses[monitoredAddress] !== undefined) {
          // generate a finding
          findings.push(createAlert(
            monitoredAddress,
            addressInfo.name,
            address,
            developerAbbreviation,
            protocolName,
            protocolAbbreviation,
            FindingType[addressInfo.type],
            FindingSeverity[addressInfo.severity],
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
