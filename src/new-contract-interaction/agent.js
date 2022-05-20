const {
  Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');

const {
  isFilledString,
  isObject,
  isEmptyObject,
  isAddress,
} = require('../utils');

// helper function to create alert for contract interaction
function createContractInteractionAlert(
  contractName,
  contractAddress,
  interactionAddress,
  type,
  severity,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  addresses,
) {
  const finding = {
    name: `${protocolName} New Contract Interaction`,
    description: `The ${contractName} contract interacted with a new contract ${interactionAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-CONTRACT-INTERACTION`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      interactionAddress,
    },
    addresses,
  };

  return Finding.fromObject(finding);
}

// helper function to create alert for EOA interaction
function createEOAInteractionAlert(
  contractName,
  contractAddress,
  interactionAddress,
  transactionCount,
  type,
  severity,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  addresses,
) {
  const finding = {
    name: `${protocolName} New EOA Interaction`,
    description: `The ${contractName} contract interacted with a new EOA ${interactionAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-EOA-INTERACTION`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      interactionAddress,
      transactionCount,
    },
    addresses,
  };

  return Finding.fromObject(finding);
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

  let contract;
  const values = Object.values(contracts);
  for (let i = 0; i < values.length; i += 1) {
    contract = values[i];
    const {
      address,
      thresholdBlockCount,
      thresholdTransactionCount,
      filteredAddresses,
      type,
      severity,
    } = contract;

    // make sure value for thresholdBlockCount in config is a number
    if (typeof thresholdBlockCount !== 'number') {
      errMsg = 'invalid thresholdBlockCount';
      return { ok, errMsg };
    }

    // make sure value for thresholdTransactionCount in config is a number
    if (typeof thresholdTransactionCount !== 'number') {
      errMsg = 'invalid thresholdTransactionCount';
      return { ok, errMsg };
    }

    // check that the address is a valid address
    if (!isAddress(address)) {
      errMsg = 'invalid address';
      return { ok, errMsg };
    }

    // check that filteredAddresses is an array
    if (!Array.isArray(filteredAddresses)) {
      errMsg = 'invalid filteredAddresses';
      return { ok, errMsg };
    }

    // check that all entries in filteredAddresses are valid addresses
    for (let j = 0; j < filteredAddresses.length; j += 1) {
      if (!isAddress(filteredAddresses[j])) {
        errMsg = 'invalid filteredAddress';
        return { ok, errMsg };
      }
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

  botState.provider = getEthersProvider();
  const entries = Object.entries(botState.contracts);
  botState.contracts = entries.map(([name, entry]) => ({ name, ...entry }));

  return botState;
};

const handleTransaction = async (botState, txEvent) => {
  const findings = [];

  // get all addresses involved with this transaction
  const transactionAddresses = Object.keys(txEvent.addresses);

  await Promise.all(botState.contracts.map(async (contract) => {
    const {
      name,
      address,
      filteredAddresses,
      thresholdBlockCount,
      thresholdTransactionCount,
      type,
      severity,
    } = contract;

    let exclusions = [
      address,
    ];
    exclusions = exclusions.concat(filteredAddresses);
    // filter transaction addresses to remove specified addresses

    const filteredTransactionAddresses = transactionAddresses
      .filter((item) => !exclusions.includes(item));

    let addresses = Object.keys(txEvent.addresses).map((addr) => addr.toLowerCase());
    addresses = addresses.filter((addr) => addr !== 'undefined');

    // watch for recently created contracts interacting with configured contract address
    if (txEvent.transaction.to.toLowerCase() === address.toLowerCase()) {
      const contractResults = {};
      const eoaAddresses = [];

      const results = await Promise.allSettled(
        filteredTransactionAddresses.map(async (transactionAddress) => {
          const contractCode = await botState.provider.getCode(transactionAddress);
          return { transactionAddress, code: contractCode };
        }),
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.code !== '0x') { // if there's code, then it's a contract
            contractResults[result.value.transactionAddress] = result.value.code;
          } else {
            eoaAddresses.push(result.value.transactionAddress); // if no code, then it's an EOA
          }
        }
      });

      await Promise.all(eoaAddresses.map(async (eoaAddress) => {
        const eoaTransactionCount = await botState.provider.getTransactionCount(eoaAddress);
        if (eoaTransactionCount < thresholdTransactionCount) {
          findings.push(createEOAInteractionAlert(
            name,
            address,
            eoaAddress,
            eoaTransactionCount,
            type,
            severity,
            botState.protocolName,
            botState.protocolAbbreviation,
            botState.developerAbbreviation,
            addresses,
          ));
        }
      }));

      const blockOverride = txEvent.blockNumber - thresholdBlockCount;
      const blockResults = await Promise.allSettled(
        Object.keys(contractResults).map(async (contractResult) => {
          const contractCode = await botState.provider.getCode(contractResult, blockOverride);
          return { transactionAddress: contractResult, code: contractCode };
        }),
      );

      blockResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.code !== contractResults[result.value.transactionAddress]) {
            findings.push(createContractInteractionAlert(
              name,
              address,
              result.value.transactionAddress,
              type,
              severity,
              botState.protocolName,
              botState.protocolAbbreviation,
              botState.developerAbbreviation,
              addresses,
            ));
          }
        }
      });
    }
  }));

  return findings;
};

module.exports = {
  validateConfig,
  initialize,
  handleTransaction,
  createContractInteractionAlert,
  createEOAInteractionAlert,
};
