const {
  ethers,
  createTransactionEvent,
  Finding,
  FindingType,
  FindingSeverity,
} = require('forta-agent');

// local definitions
const {
  provideInitialize, provideHandleTransaction, TORNADO_CASH_ADDRESSES,
} = require('./agent');

// load config file
const config = require('../agent-config.json');

// check the configuration file to verify the values
describe('check agent configuration file', () => {
  it('procotolName key required', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('addressList key required', () => {
    const { addressList } = config;
    expect(typeof (addressList)).toBe('object');
    expect(addressList).not.toBe({});
  });

  it('addressList key values must be valid', () => {
    const { addressList } = config;
    Object.keys(addressList).forEach((key) => {
      const { address, type, severity } = addressList[key];

      // check that the address is a valid address
      expect(ethers.utils.isHexString(address, 20)).toBe(true);

      // check type, this will fail if 'type' is not valid
      expect(Object.prototype.hasOwnProperty.call(FindingType, type)).toBe(true);

      // check severity, this will fail if 'severity' is not valid
      expect(Object.prototype.hasOwnProperty.call(FindingSeverity, severity)).toBe(true);
    });
  });
});

// tests
describe('handleTransaction', () => {
  let initializeData;
  let handleTransaction;
  let addressName;
  let testAddressInfo;
  let mockTrace;
  let mockTxEvent;
  let iface;
  const tornadoCashAddress = TORNADO_CASH_ADDRESSES[0];

  beforeEach(async () => {
    initializeData = {};

    // set up test configuration parameters that won't change with each test
    // grab the first entry from the 'contracts' key in the configuration file
    const { addressList } = config;
    [addressName] = Object.keys(addressList);
    testAddressInfo = addressList[addressName];

    // initialize the handler
    await (provideInitialize(initializeData))();
    handleTransaction = provideHandleTransaction(initializeData);

    // pull out the initialized interface to use for crafting test data
    ({ iface } = initializeData);

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
    // run agent with empty mockTxEvent
    const findings = await handleTransaction(mockTxEvent);

    // expect the suspiciousAddresses object to be empty
    expect(Object.keys(initializeData.suspiciousAddresses).length).toBe(0);

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

    // run the agent
    const findings = await handleTransaction(mockTxEvent);

    // expect the suspiciousAddresses object to contain one entry
    expect(Object.keys(initializeData.suspiciousAddresses).length).toBe(1);

    // expect no findings since there were no transactions involving a monitored address
    expect(findings).toStrictEqual([]);
  });

  it('returns no findings when suspicous addresses have been found but subsequent interactions with monitored addresses occur outside the observation interval', async () => {
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

    // run the agent
    let findings = await handleTransaction(mockTxEvent);

    // expect the suspiciousAddresses object to contain one entry
    expect(Object.keys(initializeData.suspiciousAddresses).length).toBe(1);

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

    // run the agent
    findings = await handleTransaction(mockTxEvent);

    // expect the suspiciousAddresses object to contain no entries as the only entry should have
    // been removed since the current block number minus the block number the suspicious address
    // was added to the list at is greater than the observation interval
    expect(Object.keys(initializeData.suspiciousAddresses).length).toBe(0);

    // expect no findings
    expect(findings).toStrictEqual([]);
  });

  it('returns a finding when a suspicious address was found and subsequent interactions with monitored functions have occurred within the observaion interval', async () => {
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

    // run the agent
    let findings = await handleTransaction(mockTxEvent);

    // expect the suspiciousAddresses object to contain one entry
    expect(Object.keys(initializeData.suspiciousAddresses).length).toBe(1);

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

    // run the agent
    findings = await handleTransaction(mockTxEvent);

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
        tornadoCashContractAddresses: TORNADO_CASH_ADDRESSES,
      },
    })];

    expect(findings).toStrictEqual(expectedFinding);
  });
});
