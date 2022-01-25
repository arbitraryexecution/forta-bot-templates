const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize } = require('./agent');

const utils = require('./utils');

const config = require('../agent-config.json');

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

      const functionObjects = getObjectsFromAbi(abi, 'function');

      // for all of the functions specified, verify that they exist in the ABI
      Object.keys(functions).forEach((functionName) => {
        expect(Object.keys(functionObjects).indexOf(functionName)).not.toBe(-1);

        const entry = functions[functionName];
        const { expression, type, severity } = entry;

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

function getFunctionFromConfig(abi, functions) {
  let functionInConfig;
  let functionNotInConfig;
  let findingType;
  let findingSeverity;

  const functionsInConfig = Object.keys(functions);
  const functionObjects = getObjectsFromAbi(abi, 'function');
  Object.keys(functionObjects).forEach((name) => {
    if ((functionNotInConfig !== undefined) && (functionInConfig !== undefined)) {
      return;
    }

    if ((functionsInConfig.indexOf(name) === -1) && (functionNotInConfig === undefined)) {
      functionNotInConfig = functionObjects[name];
    }

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
  functionObject.inputs.forEach((entry) => {
    argNames.push(entry.name);
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
        throw new Error('bytes not supported yet');
        break;
      case "bytes[]":
        throw new Error('bytes not supported yet');
        break;
      case "bytes32":
        throw new Error('bytes32 not supported yet');
        break;
      case "bytes32[]":
        throw new Error('Array of bytes32 not supported yet');
        break;
      case "tuple":
        throw new Error('tuple not supported yet');
        break;
    }
  });
  return { mockArgs, argNames };
}

// tests
describe('monitor functions that do not emit events', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let developerAbbreviation;
    let protocolAbbreviation;
    let protocolName;
    let contractName;
    let handleTransaction;
    let mockTrace;
    let mockTxEvent;
    let iface;
    let abi;
    let functionInConfig;
    let functionNotInConfig;
    let validContractAddress;

    beforeEach(async () => {
      initializeData = {};

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      // grab the first entry from the 'contracts' key in the configuration file
      const { contracts: configContracts } = config;
      protocolName = config.protocolName;
      protocolAbbreviation = config.protocolAbbreviation;
      developerAbbreviation = config.developerAbbreviation;

      contractName = Object.keys(configContracts)[0];
      const { abiFile, functions } = configContracts[contractName];
      validContractAddress = configContracts[contractName].address;

      abi = utils.getAbi(abiFile);

      const results = getFunctionFromConfig(abi, functions);
      functionInConfig = results.functionInConfig;
      functionNotInConfig = results.functionNotInConfig;
      findingType = results.findingType;
      findingSeverity = results.findingSeverity;

      if (functionInConfig === undefined) {
        throw new Error('Could not extract valid function from configuration file');
      }

      if (functionNotInConfig === undefined) {
        throw new Error('Could not find function from ABI not in configuration file');
      }

      iface = new ethers.utils.Interface(abi);

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
      const { mockArgs } = createMockArgs(functionInConfig);
      const mockFunctionData = iface.encodeFunctionData(functionInConfig.name, mockArgs);

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
      const { mockArgs } = createMockArgs(functionNotInConfig);
      const mockFunctionData = iface.encodeFunctionData(functionNotInConfig.name, mockArgs);

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
      const { mockArgs, argNames } = createMockArgs(functionInConfig);
      const mockFunctionData = iface.encodeFunctionData(functionInConfig.name, mockArgs);

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      // eliminate any expression
      const functionSignatures = initializeData.contracts[0].functionSignatures;
      delete functionSignatures[0].expression;
      delete functionSignatures[0].expressionObject;

      const findings = await handleTransaction(mockTxEvent);

      const argumentData = {};
      argNames.forEach((name) => argumentData[name] = '0');

      // create the expected finding
      const testFindings = [Finding.fromObject({
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-FUNCTION-CALL`,
        description: `The ${functionInConfig.name} function was invoked in the ${contractName} contract`,
        name: `${protocolName} Function Call`,
        protocol: protocolName,
        severity: FindingSeverity[findingSeverity],
        type: FindingType[findingType],
        metadata: {
          contractAddress: validContractAddress,
          contractName,
          functionName: functionInConfig.name,
          ...argumentData,
        },
      })];

      expect(findings).toStrictEqual(testFindings);
    });
  });
});
