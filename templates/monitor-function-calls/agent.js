const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

// load any agent configuration parameters
const { config } = require('../agent-config');

// load any utility functions
const { getAbi, extractFunctionArgs } = require('../common');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// helper function to create alerts
function createAlert(
  functionName,
  contractName,
  contractAddress,
  functionType,
  functionSeverity,
  args,
  everestId,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const functionArgs = extractFunctionArgs(args);
  return Finding.fromObject({
    name: `${protocolName} Function Call`,
    description: `The ${functionName} function was invoked in the ${contractName} contract`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-FUNCTION-CALL`,
    type: FindingType[functionType],
    severity: FindingSeverity[functionSeverity],
    everestId,
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      functionName,
      ...functionArgs,
    },
  });
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.contractInfo = config.contracts;
    data.everestId = config.everestId;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    // get the contract names that have events that we wish to monitor
    const contractNames = Object.keys(data.contractInfo);

    // load relevant information for each contract
    data.contracts = contractNames.map((name) => {
      const { address, abiFile, functions = {} } = data.contractInfo[name];
      const abi = getAbi(abiFile);
      const iface = new ethers.utils.Interface(abi);
      const functionNames = Object.keys(functions);

      // attempt to get function signatures for each of the function names in the config file
      const functionSignatures = functionNames.map(
        (functionName) => {
          try {
            iface.getFunction(functionName).sighash;
          } catch {} // ignore error thrown by ethers if it cannot find a suitable function fragment
        }
      );

      const contract = {
        name,
        address,
        iface,
        functions,
        functionSignatures,
      };

      return contract;
    });

    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      contracts,
      everestId,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation
    } = data;

    if (!contracts) throw new Error('handleTransaction called before initialization');

    const findings = [];

    // iterate over each contract name to get the address and function signatures
    contracts.forEach((contract) => {
      const {
        name, address, functions, functionSignatures,
      } = contract;

      // filter down to only the functions we want to alert on
      let parsedFunctions = txEvent.filterFunction(functionSignatures, address);

      // alert on each item in parsedFunctions
      parsedFunctions.forEach((parsedFunction) => {
        // get the type and severity values for the given filtered function result
        const { type, severity } = functions[parsedFunction.name];

        findings.push(createAlert(
          parsedFunction.name,
          name,
          address,
          type,
          severity,
          parsedFunction.args,
          everestId,
          protocolName,
          protocolAbbreviation,
          developerAbbreviation,
        ));
      });
    });

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
