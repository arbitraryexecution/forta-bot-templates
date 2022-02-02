const BigNumber = require('bignumber.js');
const {
  ethers, getEthersProvider, Finding, FindingSeverity, FindingType,
} = require('forta-agent');

const config = require('../agent-config.json');

// Stores information about each account
const initializeData = {};

// Initializes data required for handler
function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.alertMinimumIntervalSeconds = config.alertMinimumIntervalSeconds;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    data.provider = getEthersProvider();
    data.accounts = Object.entries(config.accountBalance).map(([accountName, entry]) => ({
      accountName,
      accountAddress: entry.address,
      accountThreshold: entry.thresholdEth,
      startTime: 0,
      numAlertsSinceLastFinding: 0,
      alertType: entry.alert.type,
      alertSeverity: entry.alert.severity,
    }));
    /* eslint-enable no-param-reassign */
  };
}

// helper function to create alerts
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
  }
  else {
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

function provideHandleBlock(data) {
  return async function handleBlock(blockEvent) {
    // upon the mining of a new block, check the specified accounts to make sure the balance of
    // each account has not fallen below the specified threshold
    const findings = [];

    const {
      accounts, provider, alertMinimumIntervalSeconds,
    } = data;

    if (!provider) {
      throw new Error('handleBlock called before initialization');
    }

    // get the block timestamp
    const blockTimestamp = new BigNumber(blockEvent.block.timestamp);

    await Promise.all(accounts.map(async (account) => {
      const {
        accountName, accountAddress, accountThreshold,
      } = account;
      const accountBalance = await provider.getBalance(accountAddress);

      /* eslint-disable no-param-reassign */
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
            data.protocolName,
            data.developerAbbreviation,
            data.protocolAbbreviation,
            account.alertType,
            account.alertSeverity,
          ));

          // restart the alert counter and update the start time
          account.numAlertsSinceLastFinding = 0;
          account.startTime = new BigNumber(blockTimestamp.toString());
        }
      }
      /* eslint-enable no-param-reassign */
    }));

    return findings;
  };
}

// exports
module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
