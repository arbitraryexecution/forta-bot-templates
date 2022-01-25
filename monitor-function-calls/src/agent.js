const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const config = require('../agent-config.json');

const { getAbi, extractFunctionArgs } = require('./common');

const { parseExpression, checkLogAgainstExpression } = require('./utils');

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

    data.contractInfo = config.contracts;

    data.developerAbbreviation = config.developerAbbreviation;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;

    const contractNames = Object.keys(data.contractInfo);

    data.contracts = contractNames.map((name) => {
      const { address, abiFile, functions = {} } = data.contractInfo[name];
      const abi = getAbi(abiFile);
      const iface = new ethers.utils.Interface(abi);
      const functionNames = Object.keys(functions);

      let functionSignatures = functionNames.map((functionName) => {
        const { expression, type, severity } = functions[functionName];
        try {
          const fragment = iface.getFunction(functionName);
          return {
            functionName,
            signature: fragment.format(ethers.utils.FormatTypes.full),
            expressionObject: parseExpression(expression),
            functionType: type,
            functionSeverity: severity,
          };
        } catch {
          return '';
        }
      });

      functionSignatures = functionSignatures.filter((result) => result !== '');

      const contract = {
        name,
        address,
        functions,
        functionSignatures,
      };

      return contract;
    });
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const { contracts, developerAbbreviation, protocolName, protocolAbbreviation } = data;

    const findings = [];

    contracts.forEach((contract) => {

      const {
        name,
        address,
        functions,
        functionSignatures
      } = contract;

      // iterate over all function signatures
      functionSignatures.forEach((entry) => {
        const {
          functionName,
          signature,
          expressionObject,
          functionType,
          functionSeverity
        } = entry;

        // filterFunction accepts either a string or an Array of strings
        // here we will only pass in one string at a time to keep the synchronization with
        // the expressions that we need to evaluate
        const parsedFunctions = txEvent.filterFunction(signature, address);

        // loop over the Array of results
        // the transaction may contain more than one function call to the same function
        parsedFunctions.forEach((parsedFunction) => {
          if (checkLogAgainstExpression(expressionObject, parsedFunction)) {
            findings.push(createAlert(
              functionName,
              name,
              address,
              functionType,
              functionSeverity,
              parsedFunction.args,
              protocolName,
              protocolAbbreviation,
              developerAbbreviation,
            ));
          }
        });
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