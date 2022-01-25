const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const BigNumber = require('bignumber.js');

const config = require('../agent-config.json');

const { getAbi, extractFunctionArgs } = require('./common');

function isNumeric(valueString) {
  // Check the substrings for a valid numeric expression
  // (characters 0-9) (optional decimal) (optional characters 0-9)
  const result = valueString.match(/^[0-9]*?[\.]?[0-9]*$/);
  if (result === null) {
    return false;
  }
  return (result[0].length === result.input.length);
}

function isAddress(valueString) {
  const result = valueString.match(/^0x[0-9a-f]{40}$/);
  if (result === null) {
    return false;
  }
  return (result[0].length === result.input.length);
}

function addressComparison(variable, operator, operand) {
  switch (operator) {
    case '===':
      return variable === operand;
    case '!==':
      return variable !== operand;
    default:
      throw new Error(`Address operator ${operator} not supported`);
  }
}

function booleanComparison(variable, operator, operand) {
  switch (operator) {
    case '===':
      return variable === operand;
    case '!==':
      return variable !== operand;
    default:
      throw new Error(`Boolean operator ${operator} not supported`);
  }
}

function bigNumberComparison(variable, operator, operand) {
  switch (operator) {
    case '===':
      return variable === operand;
    case '!==':
      return variable !== operand;
    case '>=':
      return variable.gte(operand);
    case '>':
      return variable.gt(operand);
    case '<=':
      return variable.lte(operand);
    case '<':
      return variable.lt(operand);
    default:
      throw new Error(`BigNumber operator ${operator} no supported`);
  }
}

function parseExpression(expression) {
  // Split the expression on spaces, discarding extra spaces
  const parts = expression.split(/(\s+)/).filter((str) => str.trim().length > 0);

  // Only support variable, operator, comparisonValue
  if (parts.length !== 3) {
    throw new Error('Expression must contain three terms: variable operator value');
  }

  const [ variableName, operator, value ] = parts;

  // Address
  if (isAddress(value)) {
    // Check the operator
    if (['===', '!=='].indexOf(operator) === -1) {
      throw new Error(`Unsupported address operator "${operator}": must be "===" or "!=="`);
    }
    return {
      variableName,
      operator,
      comparisonFunction: addressComparison,
      value: value.toLowerCase(),
    };
  }
  // Boolean
  else if ((value.toLowerCase() === 'true') || (value.toLowerCase() === 'false')) {
    // Check the operator
    if (['===', '!=='].indexOf(operator) === -1) {
      throw new Error(`Unsupported Boolean operator "${operator}": must be "===" or "!=="`);
    }
    return {
      variableName,
      operator,
      comparisonFunction: booleanComparison,
      value: value.toLowerCase() === 'true' ? true : false,
    };
  }
  // Number
  else if (isNumeric(value)) {
    // Check the operator
    if (['<', '<=', '===', '!==', '>=', '>'].indexOf(operator) === -1) {
      throw new Error(`Unsupported BN operator "${operator}": must be <, <=, ===, !==, >=, or >`);
    }
    return {
      variableName,
      operator,
      comparisonFunction: bigNumberComparison,
      value: new BigNumber(value),
    };
  }
  // Unhandled
  else {
    throw new Error(`Unsupported string specifying value: ${value}`);
  }
}

function checkLogAgainstExpression(expressionObject, log) {
  const { variableName: argName, operator, comparisonFunction, value: operand } = expressionObject;

  if (log.args[argName] === undefined) {
    // passed-in argument name from config file was not found in the log, which means that the
    // user's argument name does not coincide with the names of the event ABI
    const logArgNames = Object.keys(log.args);
    throw new Error(`Argument name ${argName} does not match any of the arguments found in an ${log.name} log: ${logArgNames}`);
  }

  // convert the value of argName and the operand value into their corresponding types
  // we assume that any value prefixed with '0x' is an address as a hex string, otherwise it will
  // be interpreted as an ethers BigNumber
  let argValue = log.args[argName];

  // Check if the operand type is BigNumber
  if (BigNumber.isBigNumber(operand)) {
    argValue = new BigNumber(argValue.toString());
  }

  return comparisonFunction(argValue, operator, operand);
}

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
