const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize } = require('./agent');

const utils = require('./utils');

const { createMockEventLogs, getObjectsFromAbi } = require('./test-utils');

const config = require('../agent-config.json');

const MINIMUM_EVENT_LIST = [
  'ProposalCreated',
  'VoteCast',
  'ProposalCanceled',
  'ProposalExecuted',
];

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

  describe('governance key required', () => {
    const { governance } = config;
    expect(typeof (governance)).toBe('object');
    expect(governance).not.toBe({});
  });

  describe('governance key values must be valid', () => {
    const { governance } = config;
    const { abiFile, address } = governance;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    const abi = utils.getAbi(abiFile);

    // extract all of the event names from the ABI
    const events = getObjectsFromAbi(abi, 'event');

    // verify that at least the minimum list of supported events are present
    MINIMUM_EVENT_LIST.forEach((eventName) => {
      if (Object.keys(events).indexOf(eventName) === -1) {
        throw new Error(`ABI does not contain minimum supported event: ${eventName}`);
      }
    });
  });
});

const abi = utils.getAbi(config.governance.abiFile);

const invalidEvent = {
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
abi.push(invalidEvent);
const iface = new ethers.utils.Interface(abi);

// tests
describe('monitor governance contracts for emitted events', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let mockTxEvent;
    let validEvent;
    let validContractAddress;
    const validEventName = 'ProposalCreated';
    const mockContractName = 'mockContractName';

    beforeEach(async () => {
      initializeData = {};

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      validContractAddress = config.governance.address;

      const eventsInAbi = getObjectsFromAbi(abi, 'event');
      validEvent = eventsInAbi[validEventName];

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
      const {
        mockArgs,
        mockTopics,
        data,
      } = createMockEventLogs(validEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = ethers.constants.AddressZero;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(validEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address matches but no monitored event was emitted', async () => {
      // encode event data - valid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(invalidEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(invalidEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns findings if contract address matches and monitored event was emitted', async () => {
      // encode event data - valid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(validEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(validEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      const proposal = {
        proposalId: '0',
        _values: '0',
        calldatas: '0xff',
        description: 'test',
        endBlock: '0',
        startBlock: '0',
        targets: ethers.constants.AddressZero,
        proposer: ethers.constants.AddressZero,
        signatures: 'test',
      };
      const expectedFinding = Finding.fromObject({
        name: `${config.protocolName} Governance Proposal Created`,
        description: `Governance Proposal ${proposal.proposalId} was just created`,
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-PROPOSAL-CREATED`,
        type: 'Info',
        severity: 'Info',
        protocol: config.protocolName,
        metadata: {
          address: validContractAddress,
          ...proposal,
        },
      });

      expect(findings).toStrictEqual([expectedFinding]);
    });
  });
});
