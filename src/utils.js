const BigNumber = require('bignumber.js');
const RollingMath = require('rolling-math');
const { ethers } = require('forta-agent');

function getAbi(agentName, abiFile) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const abiPath = `../abi/${agentName}`;
  const { abi } = require(`${abiPath}/${abiFile}`);
  return abi;
}

function getInternalAbi(agentType, abiFile) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const abiPath = `./${agentType}/internal-abi`;
  const { abi } = require(`${abiPath}/${abiFile}`);
  return abi;
}

// helper function that identifies key strings in the args array obtained from log parsing
// these key-value pairs will be added to the metadata as event args
// all values are converted to strings so that BigNumbers are readable
function extractEventArgs(args) {
  const eventArgs = {};
  Object.keys(args).forEach((key) => {
    if (Number.isNaN(Number(key))) {
      eventArgs[key] = args[key].toString();
    }
  });
  return eventArgs;
}

function isNumeric(valueString) {
  const result = new BigNumber(valueString);
  return !(result.isNaN());
}

function isAddress(valueString) {
  return ethers.utils.isHexString(valueString, 20);
}

function addressComparison(variable, operator, operand) {
  switch (operator) {
    case '===':
      return variable.toLowerCase() === operand.toLowerCase();
    case '!==':
      return variable.toLowerCase() !== operand.toLowerCase();
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
      return variable.eq(operand);
    case '!==':
      return !(variable.eq(operand));
    case '>=':
      return variable.gte(operand);
    case '>':
      return variable.gt(operand);
    case '<=':
      return variable.lte(operand);
    case '<':
      return variable.lt(operand);
    default:
      throw new Error(`BigNumber operator ${operator} not supported`);
  }
}

function parseExpression(expression) {
  // Split the expression on spaces, discarding extra spaces
  const parts = expression.split(/(\s+)/).filter((str) => str.trim().length > 0);

  // Only support variable, operator, comparisonValue
  if (parts.length !== 3) {
    throw new Error('Expression must contain three terms: variable operator value');
  }

  const [variableName, operator, value] = parts;

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
  if ((value.toLowerCase() === 'true') || (value.toLowerCase() === 'false')) {
    // Check the operator
    if (['===', '!=='].indexOf(operator) === -1) {
      throw new Error(`Unsupported Boolean operator "${operator}": must be "===" or "!=="`);
    }
    return {
      variableName,
      operator,
      comparisonFunction: booleanComparison,
      value: value.toLowerCase() === 'true',
    };
  }

  // Number
  if (isNumeric(value)) {
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
  throw new Error(`Unsupported string specifying value: ${value}`);
}

function checkLogAgainstExpression(expressionObject, log) {
  const {
    variableName: argName, operator, comparisonFunction, value: operand,
  } = expressionObject;

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



// get a list of variable getter information objects for each variable name listed for a given
// contract in the config
function getVariableInfo(contractConfig, currentContract) {
  const { variables } = contractConfig;
  const info = [];

  const variableNames = Object.keys(variables);

  variableNames.forEach((variableName) => {
    const variableInfo = variables[variableName];

    // make sure either upper threshold percent or lower threshold percent for a given variable
    // is defined in the config
    if (variableInfo.upperThresholdPercent === undefined
      && variableInfo.lowerThresholdPercent === undefined) {
      throw new Error('Either the upperThresholdPercent or lowerThresholdPercent for the'
        + ` variable ${variableName} must be defined`);
    }

    const getterObject = {
      name: variableName,
      type: variables[variableName].type,
      severity: variables[variableName].severity,
      contractInfo: currentContract,
    };

    if (variableInfo.upperThresholdPercent !== undefined) {
      getterObject.upperThresholdPercent = variableInfo.upperThresholdPercent;
    }
    if (variableInfo.lowerThresholdPercent !== undefined) {
      getterObject.lowerThresholdPercent = variableInfo.lowerThresholdPercent;
    }

    // create the rolling math array, if numDataPoints is present in the config use its
    // corresponding value for array size, otherwise set the array size to 1
    const arraySize = variableInfo.numDataPoints ? variableInfo.numDataPoints : 1;
    getterObject.pastValues = new RollingMath(arraySize);
    getterObject.minNumElements = arraySize;

    info.push(getterObject);
  });

  return { info };
}

function checkThreshold(thresholdPercent, currValue, pastValues) {
  const thresholdPercentBN = new BigNumber(thresholdPercent);
  const averageBN = pastValues.getAverage();
  const differenceBN = currValue.minus(averageBN).abs();
  const differencePercentBN = differenceBN.div(averageBN).times(100);
  let percentOver;

  if (differencePercentBN.gt(thresholdPercentBN)) {
    percentOver = differencePercentBN;
  }

  return percentOver;
}

// helper function that identifies key strings in the args array obtained from transaction parsing
// these key-value pairs will be added to the metadata as function args
// all values are converted to strings so that BigNumbers are readable
function extractFunctionArgs(args) {
  const functionArgs = {};
  Object.keys(args).forEach((key) => {
    if (Number.isNaN(Number(key))) {
      functionArgs[key] = args[key].toString();
    }
  });
  return functionArgs;
}

// create a fake function name
function getRandomCharacterString(numCharacters) {
  let result = '';
  let charCode;
  for (let i = 0; i < numCharacters; i++) {
    charCode = Math.floor(Math.random() * 52);
    if (charCode < 26) {
      charCode += 65;
    } else {
      charCode += 97 - 26;
    }
    result += String.fromCharCode(charCode);
  }
  return result;
}

module.exports = {
  getAbi,
  getInternalAbi,
  extractFunctionArgs,
  getVariableInfo,
  checkThreshold,
  extractEventArgs,
  isNumeric,
  isAddress,
  addressComparison,
  booleanComparison,
  bigNumberComparison,
  parseExpression,
  checkLogAgainstExpression,
  getRandomCharacterString,
};
