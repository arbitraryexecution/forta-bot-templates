const {
  Finding, FindingSeverity, FindingType,
} = require('forta-agent');

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

const initialize = async (config) => {
  let agentState = {...config};

  agentState.contracts = Object.entries(config.failedTransactions).map(([contractName, entry]) => ({
    contractName,
    contractAddress: entry.address.toLowerCase(),
    txFailureLimit: entry.transactionFailuresLimit,
    failedTxs: {},
    alertType: entry.type,
    alertSeverity: entry.severity,
  }));

  return agentState;
};

const handleTransaction = async (agentState, txEvent) => {
  const findings = [];

  // check to see if any of the contracts was involved in the failed transaction
  const promises = agentState.contracts.map(async (contract) => {
    const {
      contractName: name,
      contractAddress: address,
      txFailureLimit: limit,
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
      if (blockNumber < txEvent.blockNumber - agentState.blockWindow) {
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
          agentState.blockWindow,
          agentState.protocolName,
          agentState.protocolAbbreviation,
          agentState.developerAbbreviation,
          alertType,
          alertSeverity,
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
  initialize,
  handleTransaction,
  createAlert,
};
