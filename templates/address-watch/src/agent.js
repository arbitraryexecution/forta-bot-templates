const { Finding, FindingSeverity, FindingType } = require('forta-agent');

// load config file
const config = require('./agent-config.json');

// load configuration data from agent config file
const developerAbbrev = config.developerAbbreviation || 'NA';
const protocolName = config.protocolName || 'No Protocol Name Specified';
const protocolAbbrev = config.protocolAbbrev || 'NA';
const everestId = config.everestId || 'No Everest ID Specified';
const addressList = config.addressList;


// get list of addresses to watch
const addresses = Object.keys(addressList);

function createAlert(name, address, contractName, abbrev, everestId){
  return Finding.fromObject({
    name: `${name} Address Watch`,
    description: `Address ${address} (${contractName}) was involved in a transaction`,
    alertId: `${developerAbbrev}-${abbrev}-ADDRESS-WATCH`,
    type: FindingType.Suspicious,
    severity: FindingSeverity.Low,
    everestId,
  })
}

async function handleTransaction(txEvent) {
  const findings = [];
  const txAddrs = Object.keys(txEvent.addresses).map(address => address.toLowerCase());
  
  // check if an address in the watchlist was the initiator of the transaction
  addresses.forEach((address) => {
    if (txAddrs.includes(address.toLowerCase())) {
      findings.push(createAlert(
        protocolName, address, addressList[address], protocolAbbrev, everestId
      ));
    }
  });

  return findings;
}

module.exports = {
  handleTransaction,
  createAlert,
};
