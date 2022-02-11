const {
    Finding, FindingSeverity, FindingType, ethers, getEthersProvider
} = require('forta-agent');
  
const config = require('../agent-config.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// helper function to create alert for contract interaction
function createContractInteractionAlert(
  contractName,
  contractAddress,
  interaction_address,
  blockNumber,
  findingType,
  findingSeverity,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation
) {
  const finding = {
    name: `${protocolName} Contract Interaction`,
    description: `The ${contractName} contract interacted with a new contract ${interaction_address}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-CONTRACT-INTERACTION`,
    type: FindingType[findingType],
    severity: FindingSeverity[findingSeverity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      interaction_address,
      blockNumber
    },
  };

  return Finding.fromObject(finding);
}

// helper function to create alert for EOA interaction
function createEOAInteractionAlert(
  contractName,
  contractAddress,
  interaction_address,
  transaction_count,
  findingType,
  findingSeverity,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation
) {
  const finding = {
    name: `${protocolName} EOA Interaction`,
    description: `The ${contractName} contract interacted with a new EOA ${interaction_address}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-EOA-INTERACTION`,
    type: FindingType[findingType],
    severity: FindingSeverity[findingSeverity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      interaction_address,
      transaction_count
    },
  };

  return Finding.fromObject(finding);
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    data.provider = getEthersProvider();    

    data.contractInfo = config.contracts;
    data.developerAbbreviation = config.developerAbbreviation;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    
    const contractNames = Object.keys(data.contractInfo);

    data.contracts = contractNames.map((name) => {
      const { thresholdBlockCount, thresholdTransactionCount, address, filteredAddresses, findingType, findingSeverity } = data.contractInfo[name];
        
      const contract = {
        name,
        address,
        filteredAddresses,
        thresholdBlockCount,
        thresholdTransactionCount,
        findingType,
        findingSeverity
      };

      return contract;
    });
  /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      contracts, developerAbbreviation, protocolName, protocolAbbreviation,
    } = data;

    const findings = [];
    
    // get all addresses involved with this transaction
    let transactionAddresses = Object.keys(txEvent.addresses);

    // iterate over all of the contracts from the configuration file
    await Promise.all(contracts.map(async(contract) => {
      const {
        name,
        address,
        filteredAddresses,
        thresholdBlockCount,
        thresholdTransactionCount,
        findingType,
        findingSeverity
      } = contract;

      let exclusions = [
        address,
      ];
      exclusions = exclusions.concat(filteredAddresses);
      // filter transaction addresses to remove specified addresses
      let filteredTransactionAddresses = transactionAddresses.filter((item) => !exclusions.includes(item));

      // watch for recently created contracts interacting with configured contract address
      if (txEvent.transaction.to === address) {
        let contractResults = {};
        let eoaAddresses = [];

        const results = await Promise.allSettled(filteredTransactionAddresses.map(async(transactionAddress) => {
          const contractCode = await data.provider.getCode(transactionAddress);
          return {transactionAddress: transactionAddress, code: contractCode};
        }));

        results.forEach((result) => {
          if(result.status === 'fulfilled') {
            if(result.value.code !== '0x') {
              contractResults[result.value.transactionAddress] = result.value.code;
            } else {
              eoaAddresses.push(result.value.transactionAddress);
            }
          }
        });
        
        await Promise.all(eoaAddresses.map(async(eoaAddress) => {
          const eoaTransactionCount = await data.provider.getTransactionCount(eoaAddress);

          if (eoaTransactionCount < thresholdTransactionCount) {
            findings.push(createEOAInteractionAlert(
              name,
              address,
              eoaAddress, 
              eoaTransactionCount,
              findingType,
              findingSeverity,
              protocolName,
              protocolAbbreviation,
              developerAbbreviation
            ));            
          }
        }));

        let blockOverride = txEvent.blockNumber - thresholdBlockCount;
        const blockResults = await Promise.allSettled(Object.keys(contractResults).map(async(contractResult) => {
          const contractCode = await data.provider.getCode(contractResult, blockOverride);
          return {transactionAddress: contractResult, code: contractCode};
        }));

        blockResults.forEach((result) => {
          if(result.status === 'fulfilled') {
            if(result.value.code != contractResults[result.value.transactionAddress]) {
              findings.push(createContractInteractionAlert(
                name,
                address,
                result.value.transactionAddress, 
                txEvent.blockNumber,
                findingType,
                findingSeverity,
                protocolName,
                protocolAbbreviation,
                developerAbbreviation
              ));
            }
          }
        });
      }
    }));

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createContractInteractionAlert,
  createEOAInteractionAlert
};
  