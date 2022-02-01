const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize } = require('./agent');

const {
  getFunctionFromConfig,
  getObjectsFromAbi,
  getExpressionOperand,
  createMockFunctionArgs,
 } = require('./test-utils');

const utils = require('./utils');

const config = require('../agent-config.json');

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
      expect(ethers.utils.isHexString(address, 20)).toBe(true);

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



// tests
describe('monitor functions that do not emit events', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let configContracts;
    let contractName;
    let validContractAddress;
    let abi;
    let functionObjects;
    let mockTrace;
    let mockTxEvent;
    let functionInConfig;
    let functionNotInConfig;
    let iface;
    let testConfig;
    let fakeFunctionName;

    beforeEach(async () => {
      initializeData = {};

      // set up test configuration parameters that won't change with each test
      // grab the first entry from the 'contracts' key in the configuration file
      ({ contracts: configContracts } = config);
      contractName = Object.keys(configContracts)[0];
      const { abiFile, functions } = configContracts[contractName];
      validContractAddress = configContracts[contractName].address;
      abi = utils.getAbi(abiFile);
      functionObjects = getObjectsFromAbi(abi, 'function');

      fakeFunctionName = utils.getRandomCharacterString(16);
      while (Object.keys(functionObjects).indexOf(fakeFunctionName) !== -1) {
        fakeFunctionName = utils.getRandomCharacterString(16);
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
      iface = new ethers.utils.Interface(abi);

      // retrieve a function object from the ABI corresponding to a monitored function
      // also retrieve the fake function that we know will be unmonitored
      testConfig = getFunctionFromConfig(abi, functions, fakeFunctionName);

      ({ functionInConfig, functionNotInConfig } = testConfig);

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
      const { data: mockFunctionData } = createMockFunctionArgs(functionInConfig, iface);

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
      const { data: mockFunctionData } = createMockFunctionArgs(functionNotInConfig, iface);

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
      const { mockArgs, data: mockFunctionData } = createMockFunctionArgs(functionInConfig, iface);

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
          if (functionSignature.functionName === functionInConfig.name) {
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

      let argumentData = {};
      Object.keys(mockArgs).forEach((name) => {
        argumentData[name] = mockArgs[name];
      });
      argumentData = utils.extractFunctionArgs(argumentData);

      // create the expected finding
      const testFindings = [Finding.fromObject({
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-FUNCTION-CALL`,
        description: `The ${functionInConfig.name} function was invoked in the ${contractName} contract`,
        name: `${config.protocolName} Function Call`,
        protocol: config.protocolName,
        severity: FindingSeverity[testConfig.findingSeverity],
        type: FindingType[testConfig.findingType],
        metadata: {
          contractAddress: validContractAddress,
          contractName,
          functionName: functionInConfig.name,
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
          if (functionSignature.functionName === functionInConfig.name) {
            expressionObject = functionSignature.expressionObject;
            expression = functionSignature.expression;
          }
        });
      });
      const { variableName, operator, value } = expressionObject;
      const overrideValue = getExpressionOperand(operator, value, true);

      // encode function data
      // valid function name with valid arguments
      const { mockArgs, data: mockFunctionData } = createMockFunctionArgs(
        functionInConfig,
        iface,
        { name: variableName, value: overrideValue }
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

      let argumentData = {};
      Object.keys(mockArgs).forEach((name) => {
        argumentData[name] = mockArgs[name];
      });
      argumentData = utils.extractFunctionArgs(argumentData);

      const description = `The ${functionInConfig.name} function was invoked in the ${contractName} contract, condition met: ${expression}`;

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
          functionName: functionInConfig.name,
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
          if (functionSignature.functionName === functionInConfig.name) {
            expressionObject = functionSignature.expressionObject;
          }
        });
      });
      const { variableName, operator, value } = expressionObject;
      const overrideValue = getExpressionOperand(operator, value, false);

      // encode function data
      // valid function name with valid arguments
      const { mockArgs, data: mockFunctionData } = createMockFunctionArgs(
        functionInConfig,
        iface,
        { name: variableName, value: overrideValue }
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
