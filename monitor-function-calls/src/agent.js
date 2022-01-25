const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const config = require('../agent-config.json');

const {
  parseExpression,
  checkLogAgainstExpression,
  getAbi,
  extractFunctionArgs,
} = require('./utils');

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
  expression,
) {
  const functionArgs = extractFunctionArgs(args);

  const finding = {
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
  };

  if (expression !== undefined) {
    finding.description += `, condition met: ${expression}`;
  }

  return Finding.fromObject(finding);
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
        const fragment = iface.getFunction(functionName);

        const result = {
          functionName,
          signature: fragment.format(ethers.utils.FormatTypes.full),
          functionType: type,
          functionSeverity: severity,
        };

        if (expression !== undefined) {
          result.expression = expression;
          result.expressionObject = parseExpression(expression);
        }

        return result;
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

    // iterate over all of the contracts from the configuration file
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
          expression,
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

          // if there is an expression to check, verify the condition before creating an alert
          if (expression !== undefined) {
            if (!checkLogAgainstExpression(expressionObject, parsedFunction)) {
              return;
            }
          }

          // create a finding
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
            expression,
          ));
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
