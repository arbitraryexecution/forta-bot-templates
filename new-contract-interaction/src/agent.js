const axios = require('axios');

const {
    Finding, FindingSeverity, FindingType, ethers, getEthersProvider
} = require('forta-agent');
  
const config = require('../agent-config.json');

// read the .env file and populate process.env with keys/values
require('dotenv').config();

// etherscan API components
// this endpoint will list transactions for a given address, sorted oldest to newest
const BASE_URL = 'https://api.etherscan.io/api?module=account&action=txlist&address=';
const OPTIONS = '&startblock=0&endblock=999999999&page=1&offset=10&sort=asc&apikey=';
const API_KEY = process.env.ETHERSCAN_API_KEY; // free tier is limited to 5 calls/sec

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// computes contract age in days
// units for currentTime and creationTime are SECONDS
function getContractAge(currentTime, creationTime) {
  return Math.floor((currentTime - creationTime) / 60 / (60 * 24));
}

// helper function to create alert for contract interaction
function createContractInteractionAlert(
  contractName,
  contractAddress,
  interaction_address,
  interaction_age,
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
      interaction_age
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
      const { thresholdAgeDays, thresholdTransactionCount, address, filteredAddresses, findingType, findingSeverity } = data.contractInfo[name];
        
      const contract = {
        name,
        address,
        filteredAddresses,
        thresholdAgeDays,
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

    // for performance reasons, don't continue to run this handler if an Etherscan API key
    // was not provided
    if (API_KEY === undefined) {
      return findings;
    }
    
    // get all addresses involved with this transaction
    let transaction_addresses = Object.keys(txEvent.addresses);

    // iterate over all of the contracts from the configuration file
    await Promise.all(contracts.map(async(contract) => {
      const {
        name,
        address,
        filteredAddresses,
        thresholdAgeDays,
        thresholdTransactionCount,
        findingType,
        findingSeverity
      } = contract;

      // to minimize Etherscan requests (slow and rate limited to 5/sec for the free tier),
      // exclude the lending pool address, the incentives controller, and all token addresses
      let exclusions = [
        address,
      ];

      exclusions = exclusions.concat(filteredAddresses);

      // watch for recently created contracts interacting with configured contract address
      if (txEvent.transaction.to === address) {
        // create an array of promises that retrieve the contract code for each transaction address
        const contractCodePromises = [];
        let contractCode = [];
        transaction_addresses.forEach((transaction_address) => {
          if (exclusions.includes(transaction_address)) {
            return;
          }

          // RPC call for contract code
          const codePromise = data.provider.getCode(transaction_address);
  
          // associate each transaction address with the code that was returned
          codePromise
            .then((result) => contractCode.push({ transaction_address: transaction_address, code: result }))
            // to prevent Promise.all() from rejecting, catch failed promises and set the return
            // value to undefined
            .catch(() => contractCodePromises.push(undefined));
        });
  
        // wait for the promises to be settled
        await Promise.all(contractCodePromises);
  
        // filter out EOAs from our original list of addresses
        contractAddresses = contractCode.filter((item) => (item.code !== '0x'));
        eoaAddresses = contractCode.filter((item) => (item.code === '0x'));
        eoaAddresses = eoaAddresses.map((item) => item.transaction_address);
        
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

        // Next, for each contract, query the Etherscan API for the list of transactions
        // the first transaction item returned in the results will be the earliest
        const etherscanTxlistPromises = [];
        const txData = [];
        contractAddresses.forEach((item) => {
          const txlistPromise = axios.get(BASE_URL + item.transaction_address + OPTIONS + API_KEY);
  
          // associate each address with the transaction list that was returned
          txlistPromise
            .then((result) => txData.push({ transaction_address: item.transaction_address, response: result }))
            // to prevent Promise.all() from rejecting, catch failed promises and set the return
            // value to undefined
            .catch(() => etherscanTxlistPromises.push(undefined));
        });
  
        // wait for the promises to be settled
        await Promise.all(etherscanTxlistPromises);
  
        // process the results
        txData.forEach((item) => {
          // bail if the API did not return a valid result
          if (item.response.data.status === 0) {
            return;
          }
  
          // get the timestamp from the earliest transaction
          const creationTime = item.response.data.result[0].timeStamp;
  
          // compute days elapsed since contract creation
          const currentTime = txEvent.timestamp;
          const contractAge = getContractAge(currentTime, creationTime);
  
          // filter on recent contracts (default value is 7 days; defined in agent-config.json)
          if (contractAge < thresholdAgeDays) {
            findings.push(createContractInteractionAlert(
              name,
              address,
              item.transaction_address, 
              contractAge,
              findingType,
              findingSeverity,
              protocolName,
              protocolAbbreviation,
              developerAbbreviation
            ));
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
  getContractAge,
  createContractInteractionAlert,
  createEOAInteractionAlert
};
  