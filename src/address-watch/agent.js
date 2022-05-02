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

  if (config["developerAbbreviation"] === undefined) {
      errMsg = `No developerAbbreviation found`;
      return { ok, errMsg };
  }
  if (config["protocolName"] === undefined) {
      errMsg = `No protocolName found`;
      return { ok, errMsg };
  }
  if (config["protocolAbbreviation"] === undefined) {
      errMsg = `No protocolAbbreviation found`;
      return { ok, errMsg };
  }
  if (config["contracts"] === undefined) {
      errMsg = `No contracts found`;
      return { ok, errMsg };
  }
  if (Object.keys(config.contracts).length === 0) {
    errMsg = 'Must supply at least one address to watch';
    return { ok, errMsg };
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
