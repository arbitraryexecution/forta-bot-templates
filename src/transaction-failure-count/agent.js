const {
  Finding, FindingSeverity, FindingType, getTransactionReceipt,
} = require('forta-agent');

const {
  isObject,
  isEmptyObject,
  isFilledString,
  isAddress,
} = require('../utils');

// formats provided data into a Forta alert
function createAlert(
  name,
  address,
  failedTxs,
  threshold,
  blockWindow,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  alertType,
  alertSeverity,
  addresses,
) {
  return Finding.fromObject({
    name: `${protocolName} Transaction Failure Count`,
    description: `${failedTxs.length} transactions sent to ${address} have failed in the past`
    + ` ${blockWindow} blocks`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-FAILED-TRANSACTIONS`,
    protocol: protocolName,
    severity: FindingSeverity[alertSeverity],
    type: FindingType[alertType],
    metadata: {
      contractName: name,
      contractAddress: address,
      txFailureThreshold: threshold,
      failedTxs,
    },
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

  const { contracts } = config;
  if (!isObject(contracts) || isEmptyObject(contracts)) {
    errMsg = 'contracts key required';
    return { ok, errMsg };
  }

  let entry;
  const entries = Object.entries(contracts);
  for (let i = 0; i < entries.length; i += 1) {
    [, entry] = entries[i];
    const {
      address,
      transactionFailuresLimit,
      type,
      severity,
    } = entry;

    // check that the address is a valid address
    if (!isAddress(address)) {
      errMsg = 'invalid address';
      return { ok, errMsg };
    }

    // check that the limit is a number
    if (typeof transactionFailuresLimit !== 'number') {
      errMsg = 'invalid value for transactionFailuresLimit';
      return { ok, errMsg };
    }

    // check type, this will fail if 'type' is not valid
    if (!Object.prototype.hasOwnProperty.call(FindingType, type)) {
      errMsg = 'invalid finding type!';
      return { ok, errMsg };
    }

    // check severity, this will fail if 'severity' is not valid
    if (!Object.prototype.hasOwnProperty.call(FindingSeverity, severity)) {
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

  botState.contracts = Object.entries(config.contracts).map(([contractName, entry]) => ({
    contractName,
    contractAddress: entry.address.toLowerCase(),
    transactionFailuresLimit: entry.transactionFailuresLimit,
    failedTxs: {},
    alertType: entry.type,
    alertSeverity: entry.severity,
  }));

  return botState;
};

const handleTransaction = async (botState, txEvent) => {
  const findings = [];

  // check to see if any of the contracts were involved in the failed transaction
  const promises = botState.contracts.map(async (contract) => {
    const {
      contractName: name,
      contractAddress: address,
      transactionFailuresLimit,
      alertType,
      alertSeverity,
    } = contract;

    if (txEvent.to !== address) return;

    // grab the receipt for the transaction event
    const receipt = await getTransactionReceipt(txEvent.hash);
    if (receipt.status) return;

    /* eslint-disable no-param-reassign */
    // add new occurrence
    contract.failedTxs[txEvent.hash] = txEvent.blockNumber;

    // filter out occurrences older than blockWindow
    Object.entries(contract.failedTxs).forEach(([hash, blockNumber]) => {
      if (blockNumber < txEvent.blockNumber - botState.blockWindow) {
        delete contract.failedTxs[hash];
      }
    });

    let addresses = Object.keys(txEvent.addresses).map((addr) => addr.toLowerCase());
    addresses = addresses.filter((addr) => addr !== 'undefined');

    // create finding if there are too many failed txs
    const failedTxHashes = Object.keys(contract.failedTxs);
    if (failedTxHashes.length >= transactionFailuresLimit) {
      findings.push(
        createAlert(
          name,
          address,
          failedTxHashes,
          transactionFailuresLimit,
          botState.blockWindow,
          botState.protocolName,
          botState.protocolAbbreviation,
          botState.developerAbbreviation,
          alertType,
          alertSeverity,
          addresses,
        ),
      );

      // if we raised an alert, clear out the array of failed transactions to avoid over-alerting
      contract.failedTxs = {};
    }
    /* eslint-enable no-param-reassign */
  });

  // wait for the promises to settle
  await Promise.all(promises);

  return findings;
};

module.exports = {
  validateConfig,
  initialize,
  handleTransaction,
  createAlert,
};
