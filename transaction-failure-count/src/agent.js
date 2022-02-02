const {
  Finding, FindingSeverity, FindingType,
} = require('forta-agent');

const config = require('../agent-config.json');

const initializeData = {};

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
  });
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;
    data.blockWindow = config.blockWindow;

    data.contracts = Object.entries(config.failedTransactions).map(([contractName, entry]) => ({
      contractName,
      contractAddress: entry.address.toLowerCase(),
      txFailureLimit: entry.transactionFailuresLimit,
      failedTxs: {},
      alertType: entry.type,
      alertSeverity: entry.severity,
    }));

    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      contracts,
      blockWindow,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    } = data;

    const findings = [];

    // we are only interested in failed transactions
    if (txEvent.receipt.status) {
      return findings;
    }

    // check to see if any of the contracts was involved in the failed transaction
    contracts.forEach((contract) => {
      const {
        contractName: name,
        contractAddress: address,
        txFailureLimit: limit,
        alertType,
        alertSeverity,
      } = contract;

      if (txEvent.to !== address) return;

      /* eslint-disable no-param-reassign */
      // add new occurrence
      contract.failedTxs[txEvent.hash] = txEvent.blockNumber;

      // filter out occurrences older than blockWindow
      Object.entries(contract.failedTxs).forEach(([hash, blockNumber]) => {
        if (blockNumber < txEvent.blockNumber - blockWindow) {
          delete contract.failedTxs[hash];
        }
      });

      // create finding if there are too many failed txs
      const failedTxHashes = Object.keys(contract.failedTxs);
      if (failedTxHashes.length >= limit) {
        findings.push(
          createAlert(
            name,
            address,
            failedTxHashes,
            limit,
            blockWindow,
            protocolName,
            protocolAbbreviation,
            developerAbbreviation,
            alertType,
            alertSeverity,
          ),
        );

        // if we raised an alert, clear out the array of failed transactions to avoid over-alerting
        contract.failedTxs = {};
      }
      /* eslint-enable no-param-reassign */
    });

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createAlert,
};
