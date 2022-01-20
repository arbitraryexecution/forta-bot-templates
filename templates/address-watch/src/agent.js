const { Finding, FindingSeverity, FindingType } = require('forta-agent');

// load config file
const config = require('./agent-config.json');

// load configuration data from agent config file
const developerAbbrev = config.developerAbbreviation;
const { protocolName } = config;
const { protocolAbbrev } = config;
const EVEREST_ID = config.everestId;
const { addressList } = config;

// get list of addresses to watch
const addresses = Object.keys(addressList);
if (addresses.length === 0) {
  throw new Error('Must supply at least one address to watch');
}

function createAlert(name, address, contractName, abbrev, type, severity, everestId) {
  return Finding.fromObject({
    name: `${name} Address Watch`,
    description: `Address ${address} (${contractName}) was involved in a transaction`,
    alertId: `${developerAbbrev}-${abbrev}-ADDRESS-WATCH`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    everestId,
  });
}

async function handleTransaction(txEvent) {
  const findings = [];
  const txAddrs = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());

  // check if an address in the watchlist was the initiator of the transaction
  addresses.forEach((address) => {
    if (txAddrs.includes(address.toLowerCase())) {
      const params = addressList[address];
      // eslint-disable-next-line max-len
      findings.push(createAlert(protocolName, address, params.name, protocolAbbrev, params.type, params.severity, EVEREST_ID));
    }
  });

  return findings;
}

module.exports = {
  handleTransaction,
};
