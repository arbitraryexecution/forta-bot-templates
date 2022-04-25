const {
  Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');

// helper function to create alert for contract interaction
function createContractInteractionAlert(
  contractName,
  contractAddress,
  interactionAddress,
  findingType,
  findingSeverity,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = {
    name: `${protocolName} New Contract Interaction`,
    description: `The ${contractName} contract interacted with a new contract ${interactionAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-CONTRACT-INTERACTION`,
    type: FindingType[findingType],
    severity: FindingSeverity[findingSeverity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      interactionAddress,
    },
  };

  return Finding.fromObject(finding);
}

// helper function to create alert for EOA interaction
function createEOAInteractionAlert(
  contractName,
  contractAddress,
  interactionAddress,
  transactionCount,
  findingType,
  findingSeverity,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = {
    name: `${protocolName} New EOA Interaction`,
    description: `The ${contractName} contract interacted with a new EOA ${interactionAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-EOA-INTERACTION`,
    type: FindingType[findingType],
    severity: FindingSeverity[findingSeverity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      interactionAddress,
      transactionCount,
    },
  };

  return Finding.fromObject(finding);
}

const initialize = async (config) => {
  let agentState = {...config};
  agentState.provider = getEthersProvider();

  agentState.contractInfo = config.contracts;

  agentState.contracts = Object.entries(agentState.contractInfo).map(([name, entry]) => {
    const {
      thresholdBlockCount,
      thresholdTransactionCount,
      address,
      filteredAddresses,
      findingType,
      findingSeverity,
    } = entry.newContractEOA;

    return {
      name,
      ...entry.newContractEOA,
    };
  });

  return agentState;
};

const handleTransaction = async (agentState, txEvent) => {
  const findings = [];

  // get all addresses involved with this transaction
  const transactionAddresses = Object.keys(txEvent.addresses);

  await Promise.all(agentState.contracts.map(async (contract) => {
    const {
      name,
      address,
      filteredAddresses,
      thresholdBlockCount,
      thresholdTransactionCount,
      findingType,
      findingSeverity,
    } = contract;

    let exclusions = [
      address,
    ];
    exclusions = exclusions.concat(filteredAddresses);
    // filter transaction addresses to remove specified addresses
    const filteredTransactionAddresses = transactionAddresses
            .filter((item) => !exclusions.includes(item));

    // watch for recently created contracts interacting with configured contract address
    if (txEvent.transaction.to === address) {
      const contractResults = {};
      const eoaAddresses = [];

      const results = await Promise.allSettled(
        filteredTransactionAddresses.map(async (transactionAddress) => {
          const contractCode = await data.provider.getCode(transactionAddress);
          return { transactionAddress, code: contractCode };
        }),
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.code !== '0x') { // if there's code, then it's a contract
            contractResults[result.value.transactionAddress] = result.value.code;
          } else {
            eoaAddresses.push(result.value.transactionAddress); // if no code, then its an EOA
          }
        }
      });

      await Promise.all(eoaAddresses.map(async (eoaAddress) => {
        const eoaTransactionCount = await data.provider.getTransactionCount(eoaAddress);

        if (eoaTransactionCount < thresholdTransactionCount) {
          findings.push(createEOAInteractionAlert(
            name,
            address,
            eoaAddress,
            eoaTransactionCount,
            findingType,
            findingSeverity,
            agentState.protocolName,
            agentState.protocolAbbreviation,
            agentState.developerAbbreviation,
          ));
        }
      }));

      const blockOverride = txEvent.blockNumber - thresholdBlockCount;
      const blockResults = await Promise.allSettled(
        Object.keys(contractResults).map(async (contractResult) => {
          const contractCode = await data.provider.getCode(contractResult, blockOverride);
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
              findingType,
              findingSeverity,
              agentState.protocolName,
              agentState.protocolAbbreviation,
              agentState.developerAbbreviation,
            ));
          }
        }
      });
    }
  }));

  return findings;
};

module.exports = {
  initialize,
  handleTransaction,
  createContractInteractionAlert,
  createEOAInteractionAlert,
};
