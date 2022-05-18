const {
  Finding, FindingSeverity, FindingType, getTransactionReceipt,
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

const initialize = async (config) => {
  const botState = { ...config };

  const { failedTransactions } = config.contracts;

  botState.contracts = Object.entries(failedTransactions).map(([contractName, entry]) => ({
    contractName,
    contractAddress: entry.address.toLowerCase(),
    txFailureLimit: entry.transactionFailuresLimit,
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
      if (blockNumber < txEvent.blockNumber - botState.blockWindow) {
        delete contract.failedTxs[hash];
      }
    });

    let addresses = Object.keys(txEvent.addresses).map((addr) => addr.toLowerCase());
    addresses = addresses.filter((addr) => addr !== 'undefined');

    // create finding if there are too many failed txs
    const failedTxHashes = Object.keys(contract.failedTxs);
    if (failedTxHashes.length >= limit) {
      findings.push(
        createAlert(
          name,
          address,
          failedTxHashes,
          limit,
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
  initialize,
  handleTransaction,
  createAlert,
};
