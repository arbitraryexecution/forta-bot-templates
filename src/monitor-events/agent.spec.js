const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const {
  getEventFromConfig,
  getExpressionOperand,
  createMockEventLogs,
} = require('../test-utils');
const utils = require('../utils');

const {
  initialize,
  handleTransaction,
} = require('./agent');

const config = {
  developerAbbreviation: 'DEVTEST',
  protocolName: 'PROTOTEST',
  protocolAbbreviation: 'PT',
  botType: 'monitor-events',
  name: 'test-bot',
  contracts: {
    GovernorBravo: {
      address: '0x408ED6354d4973f66138C91495F2f2FCbd8724C3',
      abiFile: 'test-abi',
      events: {
        ProposalCreated: {
          expression: 'proposer !== 0x9B68c14e936104e9a7a24c712BEecdc220002984',
          type: 'Info',
          severity: 'Info',
        },
      },
    },
  },
};

const abiOverride = {
  'test-abi': [
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'uint256',
          name: 'id',
          type: 'uint256',
        },
        {
          indexed: false,
          internalType: 'address',
          name: 'proposer',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'address[]',
          name: 'targets',
          type: 'address[]',
        },
        {
          indexed: false,
          internalType: 'uint256[]',
          name: 'values',
          type: 'uint256[]',
        },
        {
          indexed: false,
          internalType: 'string[]',
          name: 'signatures',
          type: 'string[]',
        },
        {
          indexed: false,
          internalType: 'bytes[]',
          name: 'calldatas',
          type: 'bytes[]',
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: 'startBlock',
          type: 'uint256',
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: 'endBlock',
          type: 'uint256',
        },
        {
          indexed: false,
          internalType: 'string',
          name: 'description',
          type: 'string',
        },
      ],
      name: 'ProposalCreated',
      type: 'event',
    },
  ],
};

describe('handleTransaction', () => {
  let botState;
  let developerAbbreviation;
  let protocolAbbreviation;
  let protocolName;
  let contractName;
  let mockTxEvent;
  let iface;
  let abi;
  let eventInConfig;
  let eventNotInConfig;
  let validContractAddress;
  let findingType;
  let findingSeverity;

  beforeEach(async () => {
    // initialize the handler
    botState = await initialize(config, abiOverride);

    // grab the first entry from the 'contracts' key in the configuration file
    const { contracts: configContracts } = config;
    protocolName = config.protocolName;
    protocolAbbreviation = config.protocolAbbreviation;
    developerAbbreviation = config.developerAbbreviation;

    [contractName] = Object.keys(configContracts);
    const { abiFile, events } = configContracts[contractName];
    validContractAddress = configContracts[contractName].address;

    abi = [...abiOverride[abiFile]];
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
      logs: [
        {
          address: '',
          topics: [],
          data: '0x',
        },
      ],
    });
  });

  it('returns empty findings if no monitored events were emitted in the transaction', async () => {
    const findings = await handleTransaction(botState, mockTxEvent);
    expect(findings).toStrictEqual([]);
  });

  it('returns empty findings if contract address does not match', async () => {
    // encode event data
    // valid event name with valid name, signature, topic, and args
    const { mockTopics, data } = createMockEventLogs(eventInConfig, iface);

    // update mock transaction event
    const [defaultLog] = mockTxEvent.logs;
    defaultLog.address = ethers.constants.AddressZero;
    defaultLog.topics = mockTopics;
    defaultLog.data = data;

    const findings = await handleTransaction(botState, mockTxEvent);

    expect(findings).toStrictEqual([]);
  });

  it('returns empty findings if contract address matches but no monitored function was invoked', async () => {
    // encode event data - valid event with valid arguments
    const { mockTopics, data } = createMockEventLogs(eventNotInConfig, iface);

    // update mock transaction event
    const [defaultLog] = mockTxEvent.logs;
    defaultLog.address = validContractAddress;
    defaultLog.topics = mockTopics;
    defaultLog.data = data;

    const findings = await handleTransaction(botState, mockTxEvent);

    expect(findings).toStrictEqual([]);
  });

  it('returns a finding if a target contract invokes a monitored function with no expression', async () => {
    // encode event data - valid event with valid arguments
    const { mockArgs, mockTopics, data } = createMockEventLogs(eventInConfig, iface);

    // update mock transaction event
    const [defaultLog] = mockTxEvent.logs;
    defaultLog.address = validContractAddress;
    defaultLog.topics = mockTopics;
    defaultLog.data = data;

    // eliminate any expression
    const { eventInfo } = botState.contracts[0];
    delete eventInfo[0].expression;
    delete eventInfo[0].expressionObject;

    let expectedMetaData = {};
    Object.keys(mockArgs).forEach((name) => {
      expectedMetaData[name] = mockArgs[name];
    });
    expectedMetaData = utils.extractEventArgs(expectedMetaData);

    const findings = await handleTransaction(botState, mockTxEvent);

    // create the expected finding
    const testFindings = [Finding.fromObject({
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-MONITOR-EVENT`,
      description: `The ${eventInConfig.name} event was emitted by the ${contractName} contract`,
      name: `${protocolName} Monitor Event`,
      protocol: protocolName,
      severity: FindingSeverity[findingSeverity],
      type: FindingType[findingType],
      metadata: {
        contractAddress: validContractAddress,
        contractName,
        eventName: eventInConfig.name,
        ...expectedMetaData,
      },
      addresses: [],
    })];

    expect(findings).toStrictEqual(testFindings);
  });

  it('returns a finding if a target contract emits a monitored event and the expression condition is met', async () => {
    // get the expression object information from the config
    // in the beforeEach block, the first event from the first `contracts` element is assigned to
    // `eventInConfig` therefore, we will retrieve the corresponding expression from the
    // `botState` object to enforce the proper condition for this test to emit a finding
    const { eventInfo } = botState.contracts[0];
    const { expressionObject, expression } = eventInfo[0];
    const { variableName: argName, operator, value: operand } = expressionObject;

    // determine what the argument value should be given the expression, so that the expression
    // will evaluate to true
    const overrideValue = getExpressionOperand(operator, operand, true);

    // encode event data with argument override value
    const { mockArgs, mockTopics, data } = createMockEventLogs(
      eventInConfig, iface, { name: argName, value: overrideValue },
    );

    // update mock transaction event
    const [defaultLog] = mockTxEvent.logs;
    defaultLog.address = validContractAddress;
    defaultLog.topics = mockTopics;
    defaultLog.data = data;

    let expectedMetaData = {};
    Object.keys(mockArgs).forEach((name) => {
      expectedMetaData[name] = mockArgs[name];
    });
    expectedMetaData = utils.extractEventArgs(expectedMetaData);

    const findings = await handleTransaction(botState, mockTxEvent);

    // create the expected finding
    const testFindings = [Finding.fromObject({
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-MONITOR-EVENT`,
      description: `The ${eventInConfig.name} event was emitted by the ${contractName}`
        + ` contract with condition met: ${expression}`,
      name: `${protocolName} Monitor Event`,
      protocol: protocolName,
      severity: FindingSeverity[findingSeverity],
      type: FindingType[findingType],
      metadata: {
        contractAddress: validContractAddress,
        contractName,
        eventName: eventInConfig.name,
        ...expectedMetaData,
      },
      addresses: [],
    })];

    expect(findings).toStrictEqual(testFindings);
  });

  it('returns no finding if a target contract emits a monitored event and the expression condition is not met', async () => {
    // get the expression object information from the config
    const { eventInfo } = botState.contracts[0];
    const { expressionObject } = eventInfo[0];
    const { variableName: argName, operator, value: operand } = expressionObject;

    // determine what the argument value should be given the expression, so that the expression
    // will evaluate to false
    const overrideValue = getExpressionOperand(operator, operand, false);

    // encode event data with argument override value
    const { mockTopics, data } = createMockEventLogs(
      eventInConfig, iface, { name: argName, value: overrideValue },
    );

    // update mock transaction event
    const [defaultLog] = mockTxEvent.logs;
    defaultLog.address = validContractAddress;
    defaultLog.topics = mockTopics;
    defaultLog.data = data;

    const findings = await handleTransaction(botState, mockTxEvent);

    expect(findings).toStrictEqual([]);
  });
});
