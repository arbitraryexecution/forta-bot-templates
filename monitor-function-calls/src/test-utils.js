const BigNumber = require('bignumber.js');
const { ethers } = require('forta-agent');

const defaultTypeMap = {
  uint256: 0,
  'uint256[]': [0],
  address: ethers.constants.AddressZero,
  'address[]': [ethers.constants.AddressZero],
  bytes: '0xff',
  'bytes[]': ['0xff'],
  bytes32: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF,
  'bytes32[]': [0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF],
  string: 'test',
  'string[]': ['test'],
};

function getObjectsFromAbi(abi, objectType) {
  const contractObjects = {};
  abi.forEach((entry) => {
    if (entry.type === objectType) {
      contractObjects[entry.name] = entry;
    }
  });
  return contractObjects;
}

function getFunctionFromConfig(abi, functions, fakeFunctionName) {
  let functionInConfig;
  let functionNotInConfig;
  let findingType;
  let findingSeverity;

  const functionsInConfig = Object.keys(functions);
  const functionObjects = getObjectsFromAbi(abi, 'function');
  Object.keys(functionObjects).forEach((name) => {
    if ((functionsInConfig.indexOf(name) !== -1) && (functionInConfig === undefined)) {
      functionInConfig = functionObjects[name];
      findingType = functions[name].type;
      findingSeverity = functions[name].severity;
    }
    if (name === fakeFunctionName) {
      functionNotInConfig = functionObjects[name];
    }
  });
  return {
    functionInConfig, functionNotInConfig, findingType, findingSeverity,
  };
}

function getExpressionOperand(operator, value, expectedResult) {
  // given a value, an operator, and a corresponding expected result, return a value that
  // meets the expected result
  let leftOperand;
  /* eslint-disable no-case-declarations */
  if (BigNumber.isBigNumber(value)) {
    switch (operator) {
      case '>=':
        if (expectedResult) {
          leftOperand = value.toString();
        } else {
          leftOperand = value.minus(1).toString();
        }
        break;
      case '<=':
        if (expectedResult) {
          leftOperand = value.toString();
        } else {
          leftOperand = value.plus(1).toString();
        }
        break;
      case '===':
        if (expectedResult) {
          leftOperand = value.toString();
        } else {
          leftOperand = value.minus(1).toString();
        }
        break;
      case '>':
      case '!==':
        if (expectedResult) {
          leftOperand = value.plus(1).toString();
        } else {
          leftOperand = value.toString();
        }
        break;
      case '<':
        if (expectedResult) {
          leftOperand = value.minus(1).toString();
        } else {
          leftOperand = value.plus(1).toString();
        }
        break;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  } else if (ethers.utils.isHexString(value, 20)) {
    switch (operator) {
      case '===':
        if (expectedResult) {
          leftOperand = value;
        } else {
          let temp = ethers.BigNumber.from(value);
          if (temp.eq(0)) {
            temp = temp.add(1);
          } else {
            temp = temp.sub(1);
          }
          leftOperand = ethers.utils.hexZeroPad(temp.toHexString(), 20);
        }
        break;
      case '!==':
        if (expectedResult) {
          let temp = ethers.BigNumber.from(value);
          if (temp.eq(0)) {
            temp = temp.add(1);
          } else {
            temp = temp.sub(1);
          }
          leftOperand = ethers.utils.hexZeroPad(temp.toHexString(), 20);
        } else {
          leftOperand = value;
        }
        break;
      default:
        throw new Error(`Unsupported operator ${operator} for hexString comparison`);
    }
  } else {
    throw new Error(`Unsupported variable type ${typeof (value)} for comparison`);
  }

  /* eslint-enable no-case-declarations */
  return leftOperand;
}

function createMockFunctionArgs(functionObject, iface, override = undefined) {
  const mockArgs = [];
  const argTypes = [];
  const argValues = [];

  functionObject.inputs.forEach((entry) => {
    let value;

    // check to make sure type is supported
    if (defaultTypeMap[entry.type] === undefined) {
      throw new Error(`Type ${entry.type} is not supported`);
    }

    // determine whether to take the default value for the type, or if an override is given, take
    // that value
    if (override && entry.name === override.name) {
      ({ value } = override);
    } else {
      value = defaultTypeMap[entry.type];
    }

    argTypes.push(entry.type);
    argValues.push(value);

    // do not overwrite reserved JS words!
    if (mockArgs[entry.name] == null) {
      mockArgs[entry.name] = value;
    }
  });

  const data = iface.encodeFunctionData(functionObject.name, argValues);
  return { mockArgs, argValues, data };
}

module.exports = {
  getObjectsFromAbi,
  getFunctionFromConfig,
  getExpressionOperand,
  createMockFunctionArgs,
};
