const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { default: BigNumber } = require('bignumber.js');
const { provideHandleTransaction, provideInitialize } = require('./agent');

const utils = require('./utils');

const config = require('../agent-config.json');

// extract objects of a particular type from an ABI
// for example, 'function' or 'event'
function getObjectsFromAbi(abi, objectType) {
  const contractObjects = {};
  abi.forEach((entry) => {
    if (entry.type === objectType) {
      contractObjects[entry.name] = entry;
    }
  });
  return contractObjects;
}

// check the configuration file to verify the values
describe('check agent configuration file', () => {
  describe('procotolName key required', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  describe('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  describe('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  describe('contracts key required', () => {
    const { contracts } = config;
    expect(typeof (contracts)).toBe('object');
    expect(contracts).not.toBe({});
  });

  describe('contracts key values must be valid', () => {
    const { contracts } = config;
    Object.keys(contracts).forEach((key) => {
      const { address, abiFile, functions } = contracts[key];

      // check that the address is a valid address
      expect(utils.isAddress(address)).toBe(true);

      // load the ABI from the specified file
      // the call to getAbi will fail if the file does not exist
      const abi = utils.getAbi(abiFile);

      // get all of the function objects from the loaded ABI file
      const functionObjects = getObjectsFromAbi(abi, 'function');

      // for all of the functions specified, verify that they exist in the ABI
      Object.keys(functions).forEach((functionName) => {
        expect(Object.keys(functionObjects).indexOf(functionName)).not.toBe(-1);

        // extract the keys from the configuration file for a specific function
        const { expression, type, severity } = functions[functionName];

        // the expression key can be left out, but if it's present, verify the expression
        if (expression !== undefined) {
          // if the expression is not valid, the call to parseExpression will fail
          const expressionObject = utils.parseExpression(expression);

          // check the function definition to verify the argument name
          const { inputs } = functionObjects[functionName];
          const argumentNames = inputs.map((inputEntry) => inputEntry.name);

          // verify that the argument name is present in the function Object
          expect(argumentNames.indexOf(expressionObject.variableName)).not.toBe(-1);
        }

        // check type, this will fail if 'type' is not valid
        expect(Object.prototype.hasOwnProperty.call(FindingType, type)).toBe(true);

        // check severity, this will fail if 'severity' is not valid
        expect(Object.prototype.hasOwnProperty.call(FindingSeverity, severity)).toBe(true);
      });
    });
  });
});

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

function createMockArgs(functionObject) {
  const argValues = [];
  const argNames = [];
  const argTypes = [];

  functionObject.inputs.forEach((entry) => {
    argNames.push(entry.name);
    argTypes.push(entry.type);
    switch (entry.type) {
      case 'uint256':
        argValues.push(0);
        break;
      case 'uint256[]':
        argValues.push([0]);
        break;
      case 'address':
        argValues.push(ethers.constants.AddressZero);
        break;
      case 'address[]':
        argValues.push([ethers.constants.AddressZero]);
        break;
      case 'bytes':
        argValues.push('0xff');
        break;
      case 'bytes[]':
        argValues.push(['0xff']);
        break;
      case 'bytes32':
        argValues.push(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        break;
      case 'bytes32[]':
        argValues.push([0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF]);
        break;
      case 'string':
        argValues.push('placeholderstring');
        break;
      case 'string[]':
        argValues.push(['placeholderstring']);
        break;
      case 'tuple':
        throw new Error('tuple not supported yet');
      default:
        throw new Error(`Type passed in is not support: ${entry.type}`);
    }
  });

  return { argValues, argNames, argTypes };
}

function overrideArgument(argValues, argNames, argOverride) {
  // if an argument override is specified, attempt to set it
  if (argOverride !== undefined) {
    if (argOverride.name === undefined) {
      throw new Error('Must specify name field in argOverride Object');
    }

    // determine if the argument name specified is in the Array of argument names
    const argIndex = argNames.indexOf(argOverride.name);
    if (argIndex === -1) {
      throw new Error(`Argument name specified in argOverride variable not found in function ABI. argOverride name: ${argOverride.name}, argNames: ${argNames}`);
    }

    // check that a value is specified in the argOverride Object
    if (argOverride.value === undefined) {
      throw new Error('Must specify a value field in argOverride Object');
    }

    // update the argument value
    // eslint-disable-next-line no-param-reassign
    argValues[argIndex] = argOverride.value;
  }
}

// set up test configuration parameters that won't change with each test
// grab the first entry from the 'contracts' key in the configuration file
const { contracts: configContracts } = config;

let testConfig = {};

const contractName = Object.keys(configContracts)[0];
const { abiFile, functions } = configContracts[contractName];
const validContractAddress = configContracts[contractName].address;

const abi = utils.getAbi(abiFile);
const functionObjects = getObjectsFromAbi(abi, 'function');

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

let fakeFunctionName = getRandomCharacterString(16);
while (Object.keys(functionObjects).indexOf(fakeFunctionName) !== -1) {
  fakeFunctionName = getRandomCharacterString(16);
}

// add a fake function to the ABI in preparation for a negative test case
// do this before creating an ethers Interface with the ABI
abi.push({
  inputs: [
    { internalType: 'uint256', name: 'fakeInput0', type: 'uint256' },
    { internalType: 'uint256', name: 'fakeInput1', type: 'uint256' },
    { internalType: 'address', name: 'fakeInput1', type: 'address' },
  ],
  name: fakeFunctionName,
  outputs: [
    { internalType: 'uint256', name: 'fakeOutput0', type: 'uint256' },
    { internalType: 'address', name: 'fakeOutput1', type: 'address' },
  ],
  stateMutability: 'nonpayable',
  type: 'function',
});

// create an ethers Interface
const iface = new ethers.utils.Interface(abi);

// retrieve a function object from the ABI corresponding to a monitored function
// also retrieve the fake function that we know will be unmonitored
testConfig = getFunctionFromConfig(abi, functions, fakeFunctionName);

// tests
describe('monitor functions that do not emit events', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let mockTrace;
    let mockTxEvent;

    beforeEach(async () => {
      initializeData = {};

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      // initialize mock trace object with default values
      mockTrace = [
        {
          action: {
            to: ethers.constants.AddressZero,
            input: ethers.constants.HashZero,
            value: '0x0',
            from: ethers.constants.AddressZero,
          },
          transactionHash: '0xFAKETRANSACTIONHASH',
        },
      ];

      // initialize mock transaction event with default values
      mockTxEvent = createTransactionEvent({
        transaction: {
          to: ethers.constants.AddressZero,
          value: '0',
          data: ethers.constants.HashZero,
        },
        traces: mockTrace,
      });
    });

    it('returns empty findings if no monitored functions were invoked in the transaction', async () => {
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address does not match', async () => {
      // encode function data
      // valid function name with valid arguments
      const { argValues } = createMockArgs(testConfig.functionInConfig);
      const mockFunctionData = iface.encodeFunctionData(
        testConfig.functionInConfig.name,
        argValues,
      );

      // update mock trace object with encoded function data
      mockTrace[0].action.input = mockFunctionData;

      // update mock transaction event with new mock trace
      mockTxEvent.traces = mockTrace;

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address matches but no monitored function was invoked', async () => {
      // encode function data
      // valid function name with valid arguments
      const { argValues } = createMockArgs(testConfig.functionNotInConfig);
      const mockFunctionData = iface.encodeFunctionData(
        testConfig.functionNotInConfig.name,
        argValues,
      );

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if a target contract invokes a monitored function with no expression', async () => {
      // encode function data
      // valid function name with valid arguments
      const { argValues, argNames } = createMockArgs(testConfig.functionInConfig);
      const mockFunctionData = iface.encodeFunctionData(
        testConfig.functionInConfig.name,
        argValues,
      );

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      // eliminate any expression from the configuration file
      initializeData.contracts.forEach((contract) => {
        const { functionSignatures } = contract;
        functionSignatures.forEach((functionSignature) => {
          if (functionSignature.functionName === testConfig.functionInConfig.name) {
            // these delete statements will still work even if the keys don't exist
            /* eslint-disable no-param-reassign */
            delete functionSignature.expression;
            delete functionSignature.expressionObject;
            /* eslint-enable no-param-reassign */
          }
        });
      });

      // run the handler
      const findings = await handleTransaction(mockTxEvent);

      const argumentData = {};
      argNames.forEach((name, argIndex) => {
        if (argumentData[name] == null) {
          argumentData[name] = argValues[argIndex].toString();
        }
      });

      // create the expected finding
      const testFindings = [Finding.fromObject({
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-FUNCTION-CALL`,
        description: `The ${testConfig.functionInConfig.name} function was invoked in the ${contractName} contract`,
        name: `${config.protocolName} Function Call`,
        protocol: config.protocolName,
        severity: FindingSeverity[testConfig.findingSeverity],
        type: FindingType[testConfig.findingType],
        metadata: {
          contractAddress: validContractAddress,
          contractName,
          functionName: testConfig.functionInConfig.name,
          ...argumentData,
        },
      })];

      expect(findings).toStrictEqual(testFindings);
    });

    it('returns a finding if a target contract invokes a monitored function when the expression condition is met', async () => {
      let expression;
      let expressionObject;
      initializeData.contracts.forEach((contract) => {
        const { functionSignatures } = contract;
        functionSignatures.forEach((functionSignature) => {
          if (functionSignature.functionName === testConfig.functionInConfig.name) {
            expressionObject = functionSignature.expressionObject;
            expression = functionSignature.expression;
          }
        });
      });
      const { variableName, operator, value } = expressionObject;

      // encode function data
      // valid function name with valid arguments
      const { argValues, argNames } = createMockArgs(testConfig.functionInConfig);

      // override the argument value that corresponds to the expression condition
      const argOverride = { name: variableName };
      if (BigNumber.isBigNumber(value)) {
        switch (operator) {
          case '>=':
          case '<=':
          case '===':
            argOverride.value = value.toString();
            break;
          case '>':
          case '!==':
            argOverride.value = value.plus(1).toString();
            break;
          case '<':
            argOverride.value = value.minus(1).toString();
            break;
          default:
            throw new Error(`Unknown operator: ${operator}`);
        }
      } else if (typeof (value) === 'string') {
        if (utils.isAddress(value)) {
          let temp = ethers.BigNumber.from(value);
          switch (operator) {
            case '===':
              argOverride.value = value;
              break;
            case '!==':
              if (temp.eq(0)) {
                temp = temp.add(1);
              } else {
                temp = temp.sub(1);
              }
              argOverride.value = ethers.utils.hexZeroPad(temp.toHexString(), 20);
              break;
            default:
              throw new Error(`Unsupported operator ${operator} for address comparison`);
          }
        } else if (ethers.utils.isHexString(value)) {
          const numBytes = ethers.utils.hexDataLength(value);
          let temp = ethers.BigNumber.from(value);
          switch (operator) {
            case '===':
              argOverride.value = value;
              break;
            case '!==':
              if (temp.eq(0)) {
                temp = temp.add(1);
              } else {
                temp = temp.sub(1);
              }
              argOverride.value = ethers.utils.hexZeroPad(temp.toHexString(), numBytes);
              break;
            default:
              throw new Error(`Unsupported operator ${operator} for hexString comparison`);
          }
        }
      } else {
        throw new Error(`Unsupported variable type ${typeof (value)} for comparison`);
      }
      overrideArgument(argValues, argNames, argOverride);

      const mockFunctionData = iface.encodeFunctionData(
        testConfig.functionInConfig.name,
        argValues,
      );

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      // run the handler
      const findings = await handleTransaction(mockTxEvent);

      // create the expected finding

      const argumentData = {};
      argNames.forEach((name, argIndex) => {
        if (argumentData[name] == null) {
          argumentData[name] = argValues[argIndex].toString();
        }
      });

      const description = `The ${testConfig.functionInConfig.name} function was invoked in the ${contractName} contract, condition met: ${expression}`;

      const testFindings = [Finding.fromObject({
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-FUNCTION-CALL`,
        description,
        name: `${config.protocolName} Function Call`,
        protocol: config.protocolName,
        severity: FindingSeverity[testConfig.findingSeverity],
        type: FindingType[testConfig.findingType],
        metadata: {
          contractAddress: validContractAddress,
          contractName,
          functionName: testConfig.functionInConfig.name,
          ...argumentData,
        },
      })];

      expect(findings).toStrictEqual(testFindings);
    });

    it('returns no finding if a target contract invokes a monitored function when the expression condition is not met', async () => {
      let expressionObject;
      initializeData.contracts.forEach((contract) => {
        const { functionSignatures } = contract;
        functionSignatures.forEach((functionSignature) => {
          if (functionSignature.functionName === testConfig.functionInConfig.name) {
            expressionObject = functionSignature.expressionObject;
          }
        });
      });
      const { variableName, operator, value } = expressionObject;

      // encode function data
      // valid function name with valid arguments
      const { argValues, argNames } = createMockArgs(testConfig.functionInConfig);

      // override the argument value that corresponds to the expression condition
      // explicitly set the value so that the condition is not met
      const argOverride = { name: variableName };
      if (BigNumber.isBigNumber(value)) {
        switch (operator) {
          case '>':
          case '>=':
          case '===':
            argOverride.value = value.minus(1).toString();
            break;
          case '<':
          case '<=':
            argOverride.value = value.plus(1).toString();
            break;
          case '!==':
            argOverride.value = value.toString();
            break;
          default:
            throw new Error(`Unknown operator: ${operator}`);
        }
      } else if (typeof (value) === 'string') {
        if (utils.isAddress(value)) {
          let temp = ethers.BigNumber.from(value);
          switch (operator) {
            case '!==':
              argOverride.value = value;
              break;
            case '===':
              if (temp.eq(0)) {
                temp = temp.add(1);
              } else {
                temp = temp.sub(1);
              }
              argOverride.value = ethers.utils.hexZeroPad(temp.toHexString(), 20);
              break;
            default:
              throw new Error(`Unsupported operator ${operator} for address comparison`);
          }
        } else if (ethers.utils.isHexString(value)) {
          const numBytes = ethers.utils.hexDataLength(value);
          let temp = ethers.BigNumber.from(value);
          switch (operator) {
            case '!==':
              argOverride.value = value;
              break;
            case '===':
              if (temp.eq(0)) {
                temp = temp.add(1);
              } else {
                temp = temp.sub(1);
              }
              argOverride.value = ethers.utils.hexZeroPad(temp.toHexString(), numBytes);
              break;
            default:
              throw new Error(`Unsupported operator ${operator} for hexString comparison`);
          }
        }
      } else {
        throw new Error(`Unsupported variable type ${typeof (value)} for comparison`);
      }
      overrideArgument(argValues, argNames, argOverride);

      const mockFunctionData = iface.encodeFunctionData(
        testConfig.functionInConfig.name,
        argValues,
      );

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      // run the handler
      const findings = await handleTransaction(mockTxEvent);

      // create the expected finding
      expect(findings).toStrictEqual([]);
    });
  });
});
