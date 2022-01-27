const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize } = require('./agent');

const utils = require('./utils');

const config = require('../agent-config-test.json');

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
      const { address, abiFile, events } = contracts[key];

      // check that the address is a valid address
      expect(utils.isAddress(address)).toBe(true);

      // load the ABI from the specified file
      // the call to getAbi will fail if the file does not exist
      const abi = utils.getAbi(abiFile);

      const eventObjects = getObjectsFromAbi(abi, 'event');

      // for all of the events specified, verify that they exist in the ABI
      Object.keys(events).forEach((eventName) => {
        expect(Object.keys(eventObjects).indexOf(eventName)).not.toBe(-1);

        const entry = events[eventName];
        const { expression, type, severity } = entry;

        // the expression key can be left out, but if it's present, verify the expression
        if (expression !== undefined) {
          // if the expression is not valid, the call to parseExpression will fail
          const expressionObject = utils.parseExpression(expression);

          // check the event definition to verify the argument name
          const { inputs } = eventObjects[eventName];
          const argumentNames = inputs.map((inputEntry) => inputEntry.name);

          // verify that the argument name is present in the event Object
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

function getEventFromConfig(abi, events) {
  let eventInConfig;
  let eventNotInConfig;
  let findingType;
  let findingSeverity;

  const eventsInConfig = Object.keys(events);
  const eventObjects = getObjectsFromAbi(abi, 'event');
  Object.keys(eventObjects).forEach((name) => {
    if ((eventNotInConfig !== undefined) && (eventInConfig !== undefined)) {
      return;
    }

    if ((eventsInConfig.indexOf(name) === -1) && (eventNotInConfig === undefined)) {
      eventNotInConfig = eventObjects[name];
    }

    if ((eventsInConfig.indexOf(name) !== -1) && (eventInConfig === undefined)) {
      eventInConfig = eventObjects[name];
      findingType = events[name].type;
      findingSeverity = events[name].severity;
    }
  });
  return {
    eventInConfig, eventNotInConfig, findingType, findingSeverity,
  };
}

function createMockEventLogs(eventObject, iface) {
  const mockArgs = [];
  const mockTopics = [];
  const eventTypes = [];
  const defaultData = [];
  const abiCoder = ethers.utils.defaultAbiCoder;

  // push the topic hash of the event to mockTopics - this is the first item in a topics array
  const fragment = iface.getEvent(eventObject.name);
  mockTopics.push(iface.getEventTopic(fragment));

  eventObject.inputs.forEach((entry) => {
    switch (entry.type) {
      case 'uint256':
        if (entry.indexed) {
          mockTopics.push(0);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(0);
        }

        // do not overwrite reserved JS words!
        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = 0;
        }
        break;
      case 'uint256[]':
        if (entry.indexed) {
          throw new Error('indexed uint256[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push([1]);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = [1];
        }
        break;
      case 'address':
        if (entry.indexed) {
          mockTopics.push(ethers.constants.AddressZero);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(ethers.constants.AddressZero);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = ethers.constants.AddressZero;
        }
        break;
      case 'address[]':
        if (entry.indexed) {
          throw new Error('indexed address[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push([ethers.constants.AddressZero]);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = ethers.constants.AddressZero;
        }
        break;
      case 'bytes':
        if (entry.indexed) {
          mockTopics.push('0xff');
        } else {
          eventTypes.push(entry.type);
          defaultData.push('0xff');
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = '0xff';
        }
        break;
      case 'bytes[]':
        if (entry.indexed) {
          throw new Error('indexed bytes[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push(['0xff']);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = ['0xff'];
        }
        break;
      case 'bytes32':
        if (entry.indexed) {
          mockTopics.push(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
        }
        break;
      case 'bytes32[]':
        if (entry.indexed) {
          throw new Error('indexed bytes32[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push([0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF]);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = [
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF,
          ];
        }
        break;
      case 'string':
        if (entry.indexed) {
          mockTopics.push('test');
        } else {
          eventTypes.push(entry.type);
          defaultData.push('test');
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = 'test';
        }
        break;
      case 'string[]':
        if (entry.indexed) {
          throw new Error('indexed string[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push(['test']);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = ['test'];
        }
        break;
      case 'tuple':
        throw new Error('tuple not supported yet');
      default:
        throw new Error('Type passed in is not supported');
    }
  });

  const data = abiCoder.encode(eventTypes, defaultData);
  return { mockArgs, mockTopics, data };
}

// tests
describe('monitor emitted events', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let developerAbbreviation;
    let protocolAbbreviation;
    let protocolName;
    let contractName;
    let handleTransaction;
    let mockTxEvent;
    let iface;
    let abi;
    let eventInConfig;
    let eventNotInConfig;
    let validContractAddress;
    let findingType;
    let findingSeverity;

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

      [contractName] = Object.keys(configContracts);
      const { abiFile, events } = configContracts[contractName];
      validContractAddress = configContracts[contractName].address;

      abi = utils.getAbi(abiFile);

      const results = getEventFromConfig(abi, events);
      eventInConfig = results.eventInConfig;
      eventNotInConfig = results.eventNotInConfig;
      findingType = results.findingType;
      findingSeverity = results.findingSeverity;

      if (eventInConfig === undefined) {
        throw new Error('Could not extract valid event from configuration file');
      }

      if (eventNotInConfig === undefined) {
        // if no other events were present in the ABI, generate a default event so the tests can
        // be run
        eventNotInConfig = {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'uint256',
              name: 'testValue',
              type: 'uint256',
            },
          ],
          name: 'TESTMockEvent',
          type: 'event',
        };

        // push fake event to abi before creating the interface
        abi.push(eventNotInConfig);
      }

      iface = new ethers.utils.Interface(abi);

      // initialize mock transaction event with default values
      mockTxEvent = createTransactionEvent({
        receipt: {
          logs: [
            {
              name: '',
              address: '',
              signature: '',
              topics: [],
              data: `0x${'0'.repeat(1000)}`,
              args: [],
            },
          ],
        },
      });
    });

    it('returns empty findings if no monitored events were emitted in the transaction', async () => {
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address does not match', async () => {
      // encode event data
      // valid event name with valid name, signature, topic, and args
      const { mockArgs, mockTopics, data } = createMockEventLogs(eventInConfig, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = contractName;
      defaultLog.address = ethers.constants.AddressZero;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(eventInConfig.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address matches but no monitored function was invoked', async () => {
      // encode event data - valid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(eventNotInConfig, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = contractName;
      defaultLog.address = ethers.constants.AddressZero;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(eventNotInConfig.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if a target contract invokes a monitored function with no expression', async () => {
      // encode event data - valid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(eventInConfig, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = contractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(eventInConfig.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      // eliminate any expression
      const { eventInfo } = initializeData.contracts[0];
      delete eventInfo[0].expression;
      delete eventInfo[0].expressionObject;

      let expectedMetaData = {};
      Object.keys(mockArgs).forEach((name) => {
        expectedMetaData[name] = mockArgs[name];
      });
      expectedMetaData = utils.extractEventArgs(expectedMetaData);

      const findings = await handleTransaction(mockTxEvent);

      // create the expected finding
      const testFindings = [Finding.fromObject({
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-ADMIN-EVENT`,
        description: `The ${eventInConfig.name} event was emitted by the ${contractName} contract`,
        name: `${protocolName} Admin Event`,
        protocol: protocolName,
        severity: FindingSeverity[findingSeverity],
        type: FindingType[findingType],
        metadata: {
          contractAddress: validContractAddress,
          contractName,
          eventName: eventInConfig.name,
          ...expectedMetaData,
        },
      })];

      expect(findings).toStrictEqual(testFindings);
    });
  });
});
