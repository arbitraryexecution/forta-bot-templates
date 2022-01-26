const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize } = require('./agent');

const utils = require('./utils');

const config = require('../agent-config.json');
const { default: BigNumber } = require('bignumber.js');

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
    expect(typeof(protocolName)).toBe('string');
    expect(protocolName).not.toBe("");
  });

  describe('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof(protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe("");
  });

  describe('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof(developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe("");
  });

  describe('contracts key required', () => {
    const { contracts } = config;
    expect(typeof(contracts)).toBe('object');
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
        expect(FindingType.hasOwnProperty(type)).toBe(true);

        // check severity, this will fail if 'severity' is not valid
        expect(FindingSeverity.hasOwnProperty(severity)).toBe(true);
      });
    });
  });
});

function getFunctionFromConfig(abi, functions, fakeFunctionName) {
  let functionInConfig;
  let findingType;
  let findingSeverity;

  throw new Error('This does not work because the fake function does not exist in functions');

  const functionsInConfig = Object.keys(functions);
  const functionNotInConfig = functionsInConfig[fakeFunctionName];

  const functionObjects = getObjectsFromAbi(abi, 'function');
  Object.keys(functionObjects).forEach((name) => {
    if ((functionsInConfig.indexOf(name) !== -1) && (functionInConfig === undefined)) {
      functionInConfig = functionObjects[name];
      findingType = functions[name].type;
      findingSeverity = functions[name].severity;
    }
  });
  return { functionInConfig, functionNotInConfig, findingType, findingSeverity };
}

function createMockArgs(functionObject) {
  const mockArgs = [];
  const argNames = [];
  const argTypes = [];
  functionObject.inputs.forEach((entry) => {
    argNames.push(entry.name);
    argTypes.push(entry.type);
    switch (entry.type) {
      case "uint256":
        mockArgs.push(ethers.constants.HashZero);
        break;
      case "uint256[]":
        mockArgs.push([ethers.constants.HashZero]);
        break;
      case "address":
        mockArgs.push(ethers.constants.AddressZero);
        break;
      case "address[]":
        mockArgs.push([ethers.constants.AddressZero]);
        break;
      case "bytes":
        mockArgs.push(ethers.constants.HashZero);
        break;
      case "bytes[]":
        mockArgs.push([ethers.constants.HashZero]);
        break;
      case "bytes32":
        mockArgs.push(ethers.constants.HashZero);
        break;
      case "bytes32[]":
        mockArgs.push([ethers.constants.HashZero]);
        break;
      case "tuple":
        throw new Error('tuple not supported yet');
        break;
    }
  });
  return { mockArgs, argNames, argTypes };
}

function createArgumentData(mockArgs, argNames, argTypes) {
  const argumentData = {};
  let tempVariable;
  argNames.forEach((name, argIndex) => {
    switch (argTypes[argIndex]) {
      case 'address':
      case 'bytes32':
      case 'bytes':
        argumentData[name] = mockArgs[argIndex].toLowerCase();
        break;
      case 'address[]':
      case 'bytes32[]':
      case 'bytes[]':
        tempVariable = "";
        mockArgs[argIndex].forEach((temp, i) => {
          if (i === 0) {
            tempVariable += temp.toLowerCase();
          } else {
            tempVariable += temp.slice(2).toLowerCase();
          }
        });
        argumentData[name] = tempVariable;
        break;
      default:
        argumentData[name] = '0';
    }
  });
  return argumentData;
}

// set up test configuration parameters that won't change with each test
// grab the first entry from the 'contracts' key in the configuration file
const { contracts: configContracts } = config;
const contractNames = Object.keys(configContracts);

let contractName;
let validContractAddress;
let abi;
let testConfig = {};

contractName = Object.keys(configContracts)[0];
const { abiFile, functions } = configContracts[contractName];
validContractAddress = configContracts[contractName].address;

abi = utils.getAbi(abiFile);
const functionObjects = getObjectsFromAbi(abi, 'function');

// create a fake function name
function getRandomCharacterString(numCharacters) {
  let result = "";
  let charCode;
  for (let i=0; i<numCharacters; i++) {
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
    { internalType: "uint256", name: "fakeInput0", type: "uint256" },
    { internalType: "uint256", name: "fakeInput1", type: "uint256" },
    { internalType: "address", name: "fakeInput1", type: "address" },
  ],
  name: fakeFunctionName,
  outputs: [
    { internalType: "uint256", name: "fakeOutput0", type: "uint256" },
    { internalType: "address", name: "fakeOutput1", type: "address" }
  ],
  stateMutability: "nonpayable",
  type: "function",
});

// create an ethers Interface
let iface = new ethers.utils.Interface(abi);

// retrieve a function object from the ABI corresponding to a monitored function
// also retrieve the fake function that we know will be unmonitored
testConfig = getFunctionFromConfig(abi, functions, fakeFunctionName);

console.log('Test Config: ');
console.log(testConfig);

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
      const { mockArgs } = createMockArgs(testConfig.functionInConfig);
      const mockFunctionData = iface.encodeFunctionData(testConfig.functionInConfig.name, mockArgs);

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
      const { mockArgs } = createMockArgs(testConfig.functionNotInConfig);
      const mockFunctionData = iface.encodeFunctionData(testConfig.functionNotInConfig.name, mockArgs);

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
      const { mockArgs, argNames, argTypes } = createMockArgs(testConfig.functionInConfig);
      const mockFunctionData = iface.encodeFunctionData(testConfig.functionInConfig.name, mockArgs);

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      // eliminate any expression from the configuration file
      const functionSignatures = initializeData.contracts[0].functionSignatures;
      // these delete statements will still work even if the keys don't exist
      delete functionSignatures[0].expression;
      delete functionSignatures[0].expressionObject;

      // run the handler
      const findings = await handleTransaction(mockTxEvent);

      const argumentData = createArgumentData(mockArgs, argNames, argTypes);

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

      // eliminate any expression from the configuration file
      const functionSignatures = initializeData.contracts[0].functionSignatures;

      // these delete statements will still work even if the keys don't exist
      const { expression } = functionSignatures[0];
      const { variableName, operator, value } = functionSignatures[0].expressionObject;

      // encode function data
      // valid function name with valid arguments
      const { mockArgs, argNames, argTypes } = createMockArgs(testConfig.functionInConfig);

      const argumentData = createArgumentData(mockArgs, argNames, argTypes);

      // find the variable name in the Array of argument names
      // examine the operator and variable type
      // reset the appropriate value in the mockArgs Array to meet the condition
      const argIndex = argNames.indexOf(variableName);
      if (BigNumber.isBigNumber(value)) {
        switch (operator) {
          case '>=':
          case '<=':
          case '===':
            // set the argument equal to the expression value
            mockArgs[argIndex] = ethers.BigNumber.from(value.toString()).toHexString();
            break;
          case '>':
          case '!==':
            // set the argument just slightly higher than the expression value
            mockArgs[argIndex] = ethers.BigNumber.from(value.plus(1).toString()).toHexString();
            break;
          case '<':
            // set the argument just slightly lower than the expression value
            mockArgs[argIndex] = ethers.BigNumber.from(value.minus(1).toString()).toHexString();
            break;
        }
        argumentData[argNames[argIndex]] = ethers.BigNumber.from(mockArgs[argIndex]).toString();
      }
      else if (typeof(value) === 'boolean') {
      }
      else if (utils.isAddress(value)) {
        switch (operator) {
          case '===':
            mockArgs[argIndex] = value.toString();
            break;
          case '!==':
            if (mockArgs[argIndex] === value) {
              mockArgs[argIndex] = (new BigNumber(value)).plus(1).toString();
            }
            break;
        }
        argumentData[argNames[argIndex]] = ethers.utils.getAddress(mockArgs[argIndex].toString());
      }

      const mockFunctionData = iface.encodeFunctionData(testConfig.functionInConfig.name, mockArgs);

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

      // eliminate any expression from the configuration file
      const functionSignatures = initializeData.contracts[0].functionSignatures;

      // these delete statements will still work even if the keys don't exist
      const { expression } = functionSignatures[0];
      const { variableName, operator, value } = functionSignatures[0].expressionObject;

      // encode function data
      // valid function name with valid arguments
      const { mockArgs, argNames, argTypes } = createMockArgs(testConfig.functionInConfig);

      const argumentData = {};
      argNames.forEach((name, argIndex) => {
        argumentData[name] = '0';
      });

      // find the variable name in the Array of argument names
      // examine the operator and variable type
      // reset the appropriate value in the mockArgs Array to NOT meet the condition
      const argIndex = argNames.indexOf(variableName);
      if (BigNumber.isBigNumber(value)) {
        switch (operator) {
          case '>=':
          case '>':
          case '===':
            // set the argument just slightly lower than the expression value
            mockArgs[argIndex] = ethers.BigNumber.from(value.minus(1).toString()).toHexString();
            break;
          case '!==':
            // set the argument equal to the expression value
            mockArgs[argIndex] = ethers.BigNumber.from(value.toString()).toHexString();
            break;
          case '<':
          case '<=':
            // set the argument just slightly higher than the expression value
            mockArgs[argIndex] = ethers.BigNumber.from(value.plus(1).toString()).toHexString();
            break;
        }
        argumentData[argNames[argIndex]] = ethers.BigNumber.from(mockArgs[argIndex]).toString();
      }
      else if (typeof(value) === 'boolean') {
      }
      else if (utils.isAddress(value)) {
        switch (operator) {
          case '!==':
            mockArgs[argIndex] = value.toString();
            break;
          case '===':
            if (mockArgs[argIndex] === value) {
              mockArgs[argIndex] = (new BigNumber(value)).plus(1).toString();
            }
            break;
        }
        argumentData[argNames[argIndex]] = ethers.utils.getAddress(mockArgs[argIndex].toString());
      }

      const mockFunctionData = iface.encodeFunctionData(testConfig.functionInConfig.name, mockArgs);

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
