const {
  ethers,
  createTransactionEvent,
  Finding,
  FindingType,
  FindingSeverity,
} = require('forta-agent');

const {
  initialize,
  handleTransaction,
  TORNADO_CASH_ADDRESSES,
} = require('./agent');

const config = {
  developerAbbreviation: 'DEVTEST',
  protocolName: 'PROTOTEST',
  protocolAbbreviation: 'PT',
  botType: 'tornado-cash-monitor',
  name: 'test-bot',
  observationIntervalInBlocks: 10,
  contracts: {
    contractName1: {
      address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
      type: 'Info',
      severity: 'Info',
    },
  },
};

// tests
describe('handleTransaction', () => {
  let botState;
  let addressName;
  let testAddressInfo;
  let mockTrace;
  let mockTxEvent;
  let iface;
  const tornadoCashAddress = TORNADO_CASH_ADDRESSES[0].toLowerCase();

  beforeEach(async () => {
    // set up test configuration parameters that won't change with each test
    // grab the first entry from the 'addressList' key in the configuration file
    const { contracts } = config;
    [addressName] = Object.keys(contracts);
    testAddressInfo = contracts[addressName];

    botState = await initialize(config);

    // pull out the initialized interface to use for crafting test data
    ({ iface } = botState);

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
      block: {
        number: 10000,
      },
      addresses: {},
      transaction: {
        to: ethers.constants.AddressZero,
        from: ethers.constants.AddressZero,
        value: '0',
        data: ethers.constants.HashZero,
      },
      traces: mockTrace,
    });
  });

  it('returns no findings if no deposit/withdraw function from a tornado cash proxy was called', async () => {
    // run bot with empty mockTxEvent
    const findings = await handleTransaction(botState, mockTxEvent);

    // expect the suspiciousAddresses object to be empty
    expect(Object.keys(botState.suspiciousAddresses).length).toBe(0);

    // expect no findings
    expect(findings).toStrictEqual([]);
  });

  it('returns no findings when a deposit/withdraw function from tornado cash is called but there are no subsequent interactions with monitored addresses', async () => {
    // setup some mock function arguments to be encoded as mock function data
    const mockFunctionArgs = [
      '0x1111111111111111111111111111111111111111',
      ethers.utils.hexZeroPad('0xff', 32),
      '0xff',
    ];

    const mockFunctionData = iface.encodeFunctionData('deposit', mockFunctionArgs);

    // update mock trace object with encoded function data
    mockTrace[0].action.input = mockFunctionData;
    mockTrace[0].action.to = tornadoCashAddress;
    mockTrace[0].action.from = ethers.utils.AddressZero;

    // update mock transaction event with new mock trace
    mockTxEvent.traces = mockTrace;
    mockTxEvent.transaction.to = tornadoCashAddress;
    mockTxEvent.transaction.from = ethers.utils.AddressZero;
    mockTxEvent.addresses = {
      [ethers.utils.AddressZero]: true,
      [tornadoCashAddress]: true,
    };

    // run the bot
    const findings = await handleTransaction(botState, mockTxEvent);

    // expect the suspiciousAddresses object to contain one entry
    expect(Object.keys(botState.suspiciousAddresses).length).toBe(1);

    // expect no findings since there were no transactions involving a monitored address
    expect(findings).toStrictEqual([]);
  });

  it('returns no findings when suspicious addresses have been found but subsequent interactions with monitored addresses occur outside the observation interval', async () => {
    const mockSuspiciousAddress = '0x2222222222222222222222222222222222222222';

    // setup some mock function arguments to be encoded as mock function data
    const mockFunctionArgs = [
      '0x1111111111111111111111111111111111111111',
      ethers.utils.hexZeroPad('0xff', 32),
      '0xff',
    ];

    const mockFunctionData = iface.encodeFunctionData('deposit', mockFunctionArgs);

    // update mock trace object with encoded function data
    mockTrace[0].action.input = mockFunctionData;
    mockTrace[0].action.to = tornadoCashAddress;
    mockTrace[0].action.from = mockSuspiciousAddress;

    // update mock transaction event with new mock trace
    mockTxEvent.traces = mockTrace;
    mockTxEvent.transaction.to = tornadoCashAddress;
    mockTxEvent.transaction.from = mockSuspiciousAddress;
    mockTxEvent.addresses = {
      [mockSuspiciousAddress]: true,
      [tornadoCashAddress]: true,
    };

    // run the bot
    let findings = await handleTransaction(botState, mockTxEvent);

    // expect the suspiciousAddresses object to contain one entry
    expect(Object.keys(botState.suspiciousAddresses).length).toBe(1);

    // expect no findings since there have not been any transactions involving a monitored address
    expect(findings).toStrictEqual([]);

    // update mock trace object to include a monitored address
    mockTrace[0].action.input = ethers.constants.HashZero;
    mockTrace[0].action.to = testAddressInfo.address;
    mockTrace[0].action.from = mockSuspiciousAddress;

    // update mock transaction event with new mock trace
    mockTxEvent.traces = mockTrace;
    mockTxEvent.transaction.to = testAddressInfo.address;
    mockTxEvent.transaction.from = mockSuspiciousAddress;
    mockTxEvent.addresses = {
      [mockSuspiciousAddress]: true,
      [testAddressInfo.address]: true,
    };

    // update the blockNumber to be one greater than the observation interval specified in the
    // config file
    mockTxEvent.block.number = mockTxEvent.block.number + config.observationIntervalInBlocks + 1;

    // run the bot
    findings = await handleTransaction(botState, mockTxEvent);

    // expect the suspiciousAddresses object to contain no entries as the only entry should have
    // been removed since the current block number minus the block number the suspicious address
    // was added to the list at is greater than the observation interval
    expect(Object.keys(botState.suspiciousAddresses).length).toBe(0);

    // expect no findings
    expect(findings).toStrictEqual([]);
  });

  it('returns a finding when a suspicious address was found and subsequent interactions with monitored functions have occurred within the observation interval', async () => {
    const mockSuspiciousAddress = '0x2222222222222222222222222222222222222222';

    // setup some mock function arguments to be encoded as mock function data
    const mockFunctionArgs = [
      '0x1111111111111111111111111111111111111111',
      ethers.utils.hexZeroPad('0xff', 32),
      '0xff',
    ];

    const mockFunctionData = iface.encodeFunctionData('deposit', mockFunctionArgs);

    // update mock trace object with encoded function data
    mockTrace[0].action.input = mockFunctionData;
    mockTrace[0].action.to = tornadoCashAddress;
    mockTrace[0].action.from = mockSuspiciousAddress;

    // update mock transaction event with new mock trace
    mockTxEvent.traces = mockTrace;
    mockTxEvent.transaction.to = tornadoCashAddress;
    mockTxEvent.transaction.from = mockSuspiciousAddress;
    mockTxEvent.addresses = {
      [mockSuspiciousAddress]: true,
      [tornadoCashAddress]: true,
    };

    // run the bot
    let findings = await handleTransaction(botState, mockTxEvent);

    // expect the suspiciousAddresses object to contain one entry
    expect(Object.keys(botState.suspiciousAddresses).length).toBe(1);

    // expect no findings since there have not been any transactions involving a monitored address
    expect(findings).toStrictEqual([]);

    // update mock trace object to include a monitored address
    mockTrace[0].action.input = ethers.constants.HashZero;
    mockTrace[0].action.to = testAddressInfo.address;
    mockTrace[0].action.from = mockSuspiciousAddress;

    // update mock transaction event with new mock trace
    mockTxEvent.traces = mockTrace;
    mockTxEvent.transaction.to = testAddressInfo.address;
    mockTxEvent.transaction.from = mockSuspiciousAddress;
    mockTxEvent.addresses = {
      [mockSuspiciousAddress]: true,
      [testAddressInfo.address]: true,
    };

    // update the blockNumber
    mockTxEvent.block.number += 1;

    // run the bot
    findings = await handleTransaction(botState, mockTxEvent);

    const expectedFinding = [Finding.fromObject({
      name: `${config.protocolName} Tornado Cash Monitor`,
      description: `The ${addressName} address (${testAddressInfo.address}) was involved in a`
        + ` transaction with an address ${mockSuspiciousAddress} that has previously interacted`
        + ' with Tornado Cash',
      alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-TORNADO-CASH-MONITOR`,
      type: FindingType[testAddressInfo.type],
      severity: FindingSeverity[testAddressInfo.severity],
      metadata: {
        monitoredAddress: testAddressInfo.address,
        name: addressName,
        suspiciousAddress: mockSuspiciousAddress,
        tornadoCashContractAddresses: TORNADO_CASH_ADDRESSES.join(','),
      },
    })];

    expect(findings).toStrictEqual(expectedFinding);
  });
});
