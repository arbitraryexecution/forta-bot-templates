const BigNumber = require('bignumber.js');
const {
  getEthersProvider, Finding, FindingSeverity, FindingType,
} = require('forta-agent');
const {
  isFilledString,
  isAddress,
  isObject,
  isEmptyObject,
} = require('../utils');

function createAlert(
  accountName,
  accountAddress,
  accountBalanceBN,
  thresholdBN,
  numAlerts,
  protocolName,
  developerAbbreviation,
  protocolAbbreviation,
  alertType,
  alertSeverity,
) {
  const name = protocolName ? `${protocolName} Account Balance` : 'Account Balance';

  let alertId;
  if (protocolAbbreviation) {
    alertId = `${developerAbbreviation}-${protocolAbbreviation}-LOW-ACCOUNT-BALANCE`;
  } else {
    alertId = `${developerAbbreviation}-LOW-ACCOUNT-BALANCE`;
  }

  const findingObject = {
    name,
    description: `The ${accountName} account has a balance below ${thresholdBN.toString()} wei`,
    alertId,
    severity: FindingSeverity[alertSeverity],
    type: FindingType[alertType],
    metadata: {
      accountName,
      accountAddress,
      accountBalance: accountBalanceBN.toString(),
      threshold: thresholdBN.toString(),
      numAlertsSinceLastFinding: numAlerts.toString(),
    },
  };

  if (protocolName) {
    findingObject.protocol = protocolName;
  }

  return Finding.fromObject(findingObject);
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

  if (!isObject(config.contracts) || isEmptyObject(config.contracts)) {
    errMsg = 'contracts key required';
    return { ok, errMsg };
  }

  let account;
  const accounts = Object.values(config.contracts);
  for (let i = 0; i < accounts.length; i += 1) {
    account = accounts[i];
    const { address, thresholdEth, type, severity } = account;

    if (!isAddress(address)) {
      errMsg = 'invalid address';
      return { ok, errMsg };
    }

    try {
      // eslint-disable-next-line no-unused-vars
      const value = new BigNumber(thresholdEth);
    } catch (error) {
      errMsg = `Cannot convert value in thresholdEth to BigNumber: ${thresholdEth}`;
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

  botState.alertMinimumIntervalSeconds = config.alertMinimumIntervalSeconds;

  const multiplier = new BigNumber(10).pow(18);

  botState.provider = getEthersProvider();
  botState.accounts = Object.entries(config.contracts).map(([accountName, entry]) => {
    const accountThresholdBN = new BigNumber(entry.thresholdEth).times(multiplier);
    return {
      accountName,
      accountAddress: entry.address,
      accountThresholdBN,
      startTime: 0,
      numAlertsSinceLastFinding: 0,
      alertType: entry.type,
      alertSeverity: entry.severity,
    };
  });

  return botState;
};

// upon the mining of a new block, check the specified accounts to make sure the balance of
// each account has not fallen below the specified threshold
const handleBlock = async (botState, blockEvent) => {
  const findings = [];

  const {
    accounts, provider, alertMinimumIntervalSeconds,
  } = botState;

  if (!provider) {
    throw new Error('handleBlock called before initialization');
  }

  const blockTimestamp = new BigNumber(blockEvent.block.timestamp);

  await Promise.all(accounts.map(async (account) => {
    const {
      accountName, accountAddress, accountThresholdBN,
    } = account;
    const accountBalance = await provider.getBalance(accountAddress);

    const accountBalanceBN = new BigNumber(accountBalance.toString());

    // If balance < threshold add an alert to the findings
    if (accountBalanceBN.lt(accountThresholdBN)) {
      // if less than the specified number of hours has elapsed, just increment the counter for
      // the number of alerts that would have been generated
      if (blockTimestamp.minus(account.startTime) < alertMinimumIntervalSeconds) {
        /* eslint-disable no-param-reassign */
        account.numAlertsSinceLastFinding += 1;
      } else {
        findings.push(createAlert(
          accountName,
          accountAddress,
          accountBalanceBN.toString(),
          accountThresholdBN.toString(),
          account.numAlertsSinceLastFinding,
          botState.protocolName,
          botState.developerAbbreviation,
          botState.protocolAbbreviation,
          account.alertType,
          account.alertSeverity,
        ));

        // restart the alert counter and update the start time
        account.numAlertsSinceLastFinding = 0;
        account.startTime = new BigNumber(blockTimestamp.toString());
        /* eslint-enable no-param-reassign */
      }
    }
  }));

  return findings;
};

module.exports = {
  validateConfig,
  initialize,
  handleBlock,
};
