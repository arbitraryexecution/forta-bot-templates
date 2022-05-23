const { Finding, FindingSeverity, FindingType } = require('forta-agent');
const {
  isFilledString,
  isAddress,
  isObject,
  isEmptyObject,
} = require('../utils');

function createAlert(botState, address, contractName, type, severity, addresses) {
  return Finding.fromObject({
    name: `${botState.protocolName} Address Watch`,
    description: `Address ${address} (${contractName}) was involved in a transaction`,
    alertId: `${botState.developerAbbreviation}-${botState.protocolAbbreviation}-ADDRESS-WATCH`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    addresses,
  });
}

const validateConfig = (config) => {
  let ok = false;
  let errMsg = '';

  if (!isFilledString(config.developerAbbreviation)) {
    errMsg = 'developerAbbreviation required';
    return { ok, errMsg };
  }
  if (!isFilledString(config.protocolName)) {
    errMsg = 'protocolName required';
    return { ok, errMsg };
  }
  if (!isFilledString(config.protocolAbbreviation)) {
    errMsg = 'protocolAbbreviation required';
    return { ok, errMsg };
  }

  let name;
  let entry;
  const entries = Object.entries(config.contracts);
  for (let i = 0; i < entries.length; i += 1) {
    [name, entry] = entries[i];

    if (!isObject(entry) || isEmptyObject(entry)) {
      errMsg = 'contract keys in contracts required';
      return { ok, errMsg };
    }

    if (entry.address === undefined) {
      errMsg = `No address found in configuration file for '${name}'`;
      return { ok, errMsg };
    }

    // check that the address is a valid address
    if (!isAddress(entry.address)) {
      errMsg = 'invalid address';
      return { ok, errMsg };
    }

    // check type, this will fail if 'type' is not valid
    if (!Object.prototype.hasOwnProperty.call(FindingType, entry.type)) {
      errMsg = 'invalid finding type!';
      return { ok, errMsg };
    }

    // check severity, this will fail if 'severity' is not valid
    if (!Object.prototype.hasOwnProperty.call(FindingSeverity, entry.severity)) {
      errMsg = 'invalid finding severity!';
      return { ok, errMsg };
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config) => {
  const botState = { ...config };

  const { ok, errMsg } = validateConfig(config);
  if (!ok) {
    throw new Error(errMsg);
  }

  botState.contracts = config.contracts;

  return botState;
};

const handleTransaction = async (botState, txEvent) => {
  const findings = [];
  let addresses = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());
  addresses = addresses.filter((address) => address !== 'undefined');

  const { contracts } = botState;

  // check if an address in the watchlist was the initiator of the transaction
  Object.entries(contracts).forEach(([name, contract]) => {
    const {
      address,
      type,
      severity,
    } = contract;
    if (addresses.includes(address.toLowerCase())) {
      findings.push(createAlert(botState, address, name, type, severity, addresses));
    }
  });

  return findings;
};

module.exports = {
  validateConfig,
  initialize,
  handleTransaction,
};
