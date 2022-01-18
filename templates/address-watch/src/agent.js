const { Finding, FindingSeverity, FindingType } = require('forta-agent');

// load config file
const config = require('../agent-config.json');

// load configuration data from agent config file
const everestId = config.everestId || 'No Everest ID Specified';
const protocolName = config.protocolName || 'No Protocol Name Specified';
const protocolAbbrev = config.protocolAbbrev || 'NA';
const addressList = config.addressList;


// get list of addresses to watch
const addresses = Object.keys(addressList);

async function handleTransaction(txEvent) {
  const findings = [];
  const { from, hash } = txEvent.transaction;

  // check if an address in the watchlist was the initiator of the transaction
  addresses.forEach((address) => {
    if (from === address.toLowerCase()) {
      findings.push(
        Finding.fromObject({
          name: `${protocolName} Address Watch`,
          description: `Address ${address} (${addressList[address]}) was involved in a transaction`,
          alertId: `AE-${protocolAbbrev}-ADDRESS-WATCH`,
          type: FindingType.Suspicious,
          severity: FindingSeverity.Low,
          metadata: {
            from,
            hash,
          },
          everestId,
        }),
      );
    }
  });

  return findings;
}

module.exports = {
  handleTransaction,
  addressList,
};
