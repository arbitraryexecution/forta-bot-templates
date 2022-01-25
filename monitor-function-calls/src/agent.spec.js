const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize } = require('./agent');

const utils = require('./utils');

const config = require('../agent-config.json');

function getFunctionsFromAbi(abi) {
  const functionObjects = {};
  abi.forEach((entry) => {
    if (entry.type === 'function') {
      functionObjects[entry.name] = entry;
    }
  });
  return functionObjects;
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

      const functionObjects = getFunctionsFromAbi(abi);

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

      const { contracts } = initializeData;

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
      const mockArgs = [[ethers.constants.AddressZero], [true]];
      const mockFunctionData = iface.encodeFunctionData('monitoredFunctionName', mockArgs);

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
      const mockArgs = [ethers.constants.AddressZero, ethers.utils.parseEther('1.0')];
      const mockFunctionData = iface.encodeFunctionData('unmonitoredFunctionName', mockArgs);

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = address;
      mockTrace[0].action.from = address;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = address;

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if a target contract invokes a monitored function', async () => {
      // encode function data
      // valid function name with valid arguments
      const mockArgs = [[ethers.constants.AddressZero], [true]];
      const mockFunctionData = iface.encodeFunctionData('monitoredFunctionName', mockArgs);

      // update mock trace object with encoded function data and correct contract address
      mockTrace[0].action.input = mockFunctionData;
      mockTrace[0].action.to = address;
      mockTrace[0].action.from = address;

      // update mock transaction event with new mock trace and correct contract address
      mockTxEvent.traces = mockTrace;
      mockTxEvent.transaction.to = address;

      const findings = await handleTransaction(mockTxEvent);

      // create the expected finding
      const testFindings = [Finding.fromObject({
      })];

      expect(findings).toStrictEqual(testFindings);
    });
  });
});
