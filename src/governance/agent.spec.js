const { Finding, createTransactionEvent, ethers } = require('forta-agent');

const {
  initialize,
  handleTransaction
} = require('./agent');

const utils = require('../utils');
const { createMockEventLogs, getObjectsFromAbi } = require('../test-utils');

const config = {
  developerAbbreviation: "DEVTEST",
  protocolName: "PROTOTEST",
  protocolAbbreviation: "PT",
  agentType: "governance",
  name: "test-agent",
  contracts: {
    contractName1: {
      address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
      governance: {
        abiFile: "Governor"
      }
    }
  }
};
const firstContractName = Object.keys(config.contracts)[0];

const abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "address",
        name: "proposer",
        type: "address"
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "targets",
        type: "address[]"
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "values",
        type: "uint256[]"
      },
      {
        indexed: false,
        internalType: "string[]",
        name: "signatures",
        type: "string[]"
      },
      {
        indexed: false,
        internalType: "bytes[]",
        name: "calldatas",
        type: "bytes[]"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "startBlock",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "endBlock",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "string",
        name: "description",
        type: "string"
      }
    ],
    name: "ProposalCreated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256"
      }
    ],
    name: "ProposalCanceled",
    type: "event"
  }
];

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
    let agentState;
    let mockTxEvent;
    let validEvent;
    let validContractAddress;
    const validEventName = 'ProposalCreated';
    const mockContractName = 'mockContractName';

    beforeEach(async () => {
      agentState = await initialize(config);

      // grab the first entry from the 'contracts' key in the config file
      validContractAddress = config.contracts[firstContractName].address;

      const eventsInAbi = getObjectsFromAbi(abi, 'event');
      validEvent = eventsInAbi[validEventName];

      // initialize mock transaction event with default values
      mockTxEvent = createTransactionEvent({
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
      });
    });

    it('returns empty findings if no monitored events were emitted in the transaction', async () => {
      const findings = await handleTransaction(agentState, mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address does not match', async () => {
      // encode event data
      // valid event name with valid name, signature, topic, and args
      const { mockArgs, mockTopics, data } = createMockEventLogs(
        validEvent,
        iface,
      );

      // update mock transaction event
      const [defaultLog] = mockTxEvent.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = ethers.constants.AddressZero;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(validEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(agentState, mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address matches but no monitored event was emitted', async () => {
      // encode event data - valid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(
        invalidEvent,
        iface,
      );

      // update mock transaction event
      const [defaultLog] = mockTxEvent.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(invalidEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(agentState, mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns findings if contract address matches and monitored event was emitted', async () => {
      // encode event data - valid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(
        validEvent,
        iface,
      );

      // update mock transaction event
      const [defaultLog] = mockTxEvent.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(validEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(agentState, mockTxEvent);

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
