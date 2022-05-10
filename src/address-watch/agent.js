const {
  isFilledString,
  isAddress,
  isObject,
  isEmptyObject
} = require('../utils');

const { Finding, FindingSeverity, FindingType } = require('forta-agent');

function createAlert(agentState, address, contractName, type, severity) {
  return Finding.fromObject({
    name: `${agentState.protocolName} Address Watch`,
    description: `Address ${address} (${contractName}) was involved in a transaction`,
    alertId: `${agentState.developerAbbreviation}-${agentState.protocolAbbrev}-ADDRESS-WATCH`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
  });
}

const validateConfig = (config) => {
  let ok = false;
  let errMsg = "";

  if (!isFilledString(config.developerAbbreviation)) {
      errMsg = `developerAbbreviation required`;
      return { ok, errMsg };
  }
  if (!isFilledString(config.protocolName)) {
      errMsg = `protocolName required`;
      return { ok, errMsg };
  }
  if (!isFilledString(config.protocolAbbreviation)) {
      errMsg = `protocolAbbreviation required`;
      return { ok, errMsg };
  }

  for (const [name, entry] of Object.entries(config.contracts)) {
    if (!isObject(entry) || isEmptyObject(entry)) {
      errMsg = `contract keys in contracts required`;
      return { ok, errMsg };
    }

    if (entry.address === undefined) {
      errMsg = `No address found in configuration file for '${name}'`;
      return { ok, errMsg };
    }

    // check that the address is a valid address
    if (!isAddress(entry.address)) {
      errMsg = `invalid address`;
      return { ok, errMsg };
    }

    if (entry.name === undefined) {
      errMsg = `No name field in configuration file for '${name}'`;
      return { ok, errMsg };
    }

    if (!isFilledString(entry.name)) {
      errMsg = `Name field needs to be filled in configuration file for '${name}'`;
      return { ok, errMsg };
    }

    if (!isObject(entry.watch)) {
      errMsg = `watch field needs to be filled in configuration file for '${name}'`;
      return { ok, errMsg };
    }

    // check type, this will fail if 'type' is not valid
    if (!Object.prototype.hasOwnProperty.call(FindingType, entry.watch.type)) {
      errMsg = `invalid finding type!`;
      return { ok, errMsg };
    }

    // check severity, this will fail if 'severity' is not valid
    if (!Object.prototype.hasOwnProperty.call(FindingSeverity, entry.watch.severity)) {
      errMsg = `invalid finding severity!`;
      return { ok, errMsg };
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config) => {
  const agentState = {...config};

  const { ok, errMsg } = validateConfig(config);
  if (!ok) {
    throw new Error(errMsg);
  }

  // get list of addresses to watch
  agentState.contractList = Object.values(config.contracts);

  return agentState;
};

const handleTransaction = async (agentState, txEvent) => {
  const findings = [];
  const txAddrs = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());

  // check if an address in the watchlist was the initiator of the transaction
  agentState.contractList.forEach((contract, index) => {
    if (txAddrs.includes(contract.address.toLowerCase())) {
      const params = Object.values(agentState.contracts)[index];
      findings.push(createAlert(agentState, contract.address, params.name, params.watch.type, params.watch.severity));
    }
  });

  return findings;
};

module.exports = {
  validateConfig,
  initialize,
  handleTransaction,
};
