const BigNumber = require('bignumber.js');
const {
  ethers, getEthersProvider, Finding, FindingSeverity, FindingType,
} = require('forta-agent');

function createAlert(
  accountName,
  accountAddress,
  accountBalance,
  thresholdEth,
  numAlerts,
  protocolName,
  developerAbbreviation,
  protocolAbbreviation,
  alertType,
  alertSeverity,
) {
  const threshold = ethers.utils.parseEther(thresholdEth.toString());
  const name = protocolName ? `${protocolName} Account Balance` : `Account Balance`;

  let alertId;
  if (protocolAbbreviation) {
    alertId = `${developerAbbreviation}-${protocolAbbreviation}-LOW-ACCOUNT-BALANCE`;
  } else {
    alertId = `${developerAbbreviation}-LOW-ACCOUNT-BALANCE`;
  }

  const findingObject = {
    name,
    description: `The ${accountName} account has a balance below ${thresholdEth} ETH`,
    alertId,
    severity: FindingSeverity[alertSeverity],
    type: FindingType[alertType],
    metadata: {
      accountName,
      accountAddress,
      accountBalance: accountBalance.toString(),
      threshold: threshold.toString(),
      numAlertsSinceLastFinding: numAlerts.toString(),
    },
  };

  if (protocolName) {
    findingObject.protocol = protocolName;
  }

  return Finding.fromObject(findingObject);
}

const initialize = async (config) => {
  let agentState = {...config};

  agentState.alertMinimumIntervalSeconds = config.alertMinimumIntervalSeconds;

  agentState.provider = getEthersProvider();
  agentState.accounts = Object.entries(config.accountBalance).map(([accountName, entry]) => ({
    accountName,
    accountAddress: entry.address,
    accountThreshold: entry.thresholdEth,
    startTime: 0,
    numAlertsSinceLastFinding: 0,
    alertType: entry.alert.type,
    alertSeverity: entry.alert.severity,
  }));

  return agentState;
};

// upon the mining of a new block, check the specified accounts to make sure the balance of
// each account has not fallen below the specified threshold
const handleBlock = async (agentState, blockEvent) => {
  const findings = [];

  const {
    accounts, provider, alertMinimumIntervalSeconds,
  } = agentState;

  if (!provider) {
    throw new Error('handleBlock called before initialization');
  }

  const blockTimestamp = new BigNumber(blockEvent.block.timestamp);
  await Promise.all(accounts.map(async (account) => {
    const {
      accountName, accountAddress, accountThreshold,
    } = account;
    const accountBalance = await provider.getBalance(accountAddress);

    // If balance < threshold add an alert to the findings
    const exponent = ethers.BigNumber.from(10).pow(18);
    if (accountBalance.lt(ethers.BigNumber.from(accountThreshold).mul(exponent))) {

      // if less than the specified number of hours has elapsed, just increment the counter for
      // the number of alerts that would have been generated
      if (blockTimestamp.minus(account.startTime) < alertMinimumIntervalSeconds) {
        account.numAlertsSinceLastFinding += 1;
      } else {
        findings.push(createAlert(
          accountName,
          accountAddress,
          accountBalance,
          accountThreshold,
          account.numAlertsSinceLastFinding,
          agentState.protocolName,
          agentState.developerAbbreviation,
          agentState.protocolAbbreviation,
          account.alertType,
          account.alertSeverity,
        ));

        // restart the alert counter and update the start time
        account.numAlertsSinceLastFinding = 0;
        account.startTime = new BigNumber(blockTimestamp.toString());
      }
    }
  }));

  return findings;
};

module.exports = {
  handleBlock,
  initialize,
};
