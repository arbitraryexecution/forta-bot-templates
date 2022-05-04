const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const {
  initialize,
  handleTransaction
} = require('./agent');

const {
  getFunctionFromConfig,
  getObjectsFromAbi,
  getExpressionOperand,
  createMockFunctionArgs,
} = require('../test-utils');
const utils = require('../utils');

const config = {
  developerAbbreviation: "DEVTEST",
  protocolName: "PROTOTEST",
  protocolAbbreviation: "PT",
  agentType: "admin-events",
  name: "test-agent",
  contracts: {
    AggregationRouterV4: {
      address: "0x1111111254fb6c44bac0bed2854e76f90643097d",
      abiFile: "test-abi",
      functions: {
        uniswapV3Swap: {
          expression: "amount > 6000",
          type: "Info",
          severity: "Info"
        }
      }
    }
  }
};

const abiOverride = {
  "test-abi": [
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "minReturn",
          type: "uint256"
        },
        {
          internalType: "uint256[]",
          name: "pools",
          type: "uint256[]"
        }
      ],
      name: "uniswapV3Swap",
      outputs: [
        {
          internalType: "uint256",
          name: "returnAmount",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    }
  ]
};

describe('monitor functions that do not emit events', () => {
  describe('handleTransaction', () => {
    let agentState;
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
      // set up test configuration parameters that won't change with each test
      // grab the first entry from the 'contracts' key in the configuration file
      ({ contracts: configContracts } = config);

      [contractName] = Object.keys(configContracts);
      const { abiFile, functions } = configContracts[contractName];
      validContractAddress = configContracts[contractName].address;

      abi = [...abiOverride[abiFile]];
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
      agentState = await initialize(config, abiOverride);

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
      const findings = await handleTransaction(agentState, mockTxEvent);
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

      const findings = await handleTransaction(agentState, mockTxEvent);

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

      const findings = await handleTransaction(agentState, mockTxEvent);

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
      agentState.contracts.forEach((contract) => {
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
      const findings = await handleTransaction(agentState, mockTxEvent);

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
      agentState.contracts.forEach((contract) => {
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
        { name: variableName, value: overrideValue },
      );

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      // run the handler
      const findings = await handleTransaction(agentState, mockTxEvent);

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
      agentState.contracts.forEach((contract) => {
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
      const { data: mockFunctionData } = createMockFunctionArgs(
        functionInConfig,
        iface,
        { name: variableName, value: overrideValue },
      );

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = validContractAddress;
      mockTrace[0].action.from = validContractAddress;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = validContractAddress;

      // run the handler
      const findings = await handleTransaction(agentState, mockTxEvent);

      // create the expected finding
      expect(findings).toStrictEqual([]);
    });
  });
});
