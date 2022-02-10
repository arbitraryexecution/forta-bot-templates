const mockTokenAddress = '0xFAKETOKENADDRESS'.toLowerCase();
const mockNewTokenAddress = '0xNEWTOKENADDRESS'.toLowerCase();
const mockContract = {
  balanceOf: jest.fn(),
  address: mockTokenAddress,
};
const mockLogs = [
  {
    address: mockTokenAddress,
  },
];
const blockNumber = 0;
const mockProvider = {
  getBalance: jest.fn(),
  getBlockNumber: jest.fn().mockResolvedValue(blockNumber),
  getLogs: jest.fn().mockResolvedValue(mockLogs),
};

jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn().mockReturnValue(mockProvider),
  ethers: {
    ...jest.requireActual('ethers'),
    providers: {
      JsonRpcBatchProvider: jest.fn(),
    },
    Contract: jest.fn().mockReturnValue(mockContract),
  },
}));

const {
  FindingType,
  FindingSeverity,
  Finding,
  TransactionEvent,
  ethers,
} = require('forta-agent');
const config = require('../agent-config.json');

const { abi: erc20Abi } = require('../abi/ERC20.json');

const erc20Interface = new ethers.utils.Interface(erc20Abi);

const { provideHandleBlock, provideHandleTransaction, provideInitialize } = require('./agent');

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

  it('gnosisSafe key required', () => {
    const { gnosisSafe } = config;
    expect(typeof (gnosisSafe)).toBe('object');
    expect(gnosisSafe).not.toBe({});
  });

  it('gnosisSafe key values must be valid', () => {
    const { gnosisSafe } = config;
    const { address, version } = gnosisSafe;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // check that there is a corresponding file for the version indicated
    // eslint-disable-next-line import/no-dynamic-require,global-require
    const { abi } = require(`../abi/${version}/gnosis_safe.json`);

    expect(typeof (abi)).toBe('object');
    expect(abi).not.toBe({});
  });
});

describe('gnosis-safe multisig monitoring', () => {
  describe('handleBlock', () => {
    let initializeData;
    let handleBlock;
    let handleTransaction;

    const logsNoMatchEvent = [
      {
        address: '0xINVALIDADDRESS',
        topics: [ethers.constants.HashZero],
      },
    ];

    beforeEach(async () => {
      // set an initial Ether balance for the contract
      mockProvider.getBalance = jest.fn().mockResolvedValue(ethers.BigNumber.from(0));

      initializeData = {};
      await (provideInitialize(initializeData))();
      handleBlock = provideHandleBlock(initializeData);
      handleTransaction = provideHandleTransaction(initializeData);
    });

    it('returns empty findings if this is the first block seen', async () => {
      // invoke the block handler
      const findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(1);
    });

    it('returns empty findings if the Ether balance is unchanged', async () => {
      // invoke the block handler
      let findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(1);

      // invoke the transaction handler with a non-matching log
      const receipt = { logs: logsNoMatchEvent };
      const mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a second time
      findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(2);
    });

    it('returns findings if the Ether balance changes', async () => {
      // set an Ether balance for the contract
      const oldValue = ethers.BigNumber.from(0);
      const newValue = ethers.BigNumber.from(1);
      mockProvider.getBalance = jest.fn()
        .mockResolvedValueOnce(oldValue)
        .mockResolvedValueOnce(newValue);

      // invoke the block handler
      let findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(1);

      // invoke the transaction handler
      const receipt = { logs: logsNoMatchEvent };
      const mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a second time
      findings = await handleBlock();

      const { alertFields, address: protocolAddress } = initializeData;
      const { protocolName, protocolAbbreviation, developerAbbreviation } = alertFields;
      const expectedFindings = [Finding.fromObject({
        name: `${protocolName} DAO Treasury MultiSig - Ether Balance Changed`,
        description: `Ether balance of ${protocolAddress} changed by 1`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-ETH-BALANCE-CHANGE`,
        protocol: 'ethereum',
        severity: FindingSeverity.Info,
        type: FindingType.Info,
        metadata: {
          previousBalance: '0',
          newBalance: '1',
        },
      })];

      expect(findings).toStrictEqual(expectedFindings);
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(2);
    });

    it('returns empty findings if token balance is unchanged', async () => {
      // set a token balance for the contract
      mockContract.balanceOf = jest.fn().mockResolvedValue(ethers.BigNumber.from(0));

      // invoke the block handler
      let findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(1);

      // invoke the transaction handler
      const receipt = { logs: logsNoMatchEvent };
      const mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a second time
      findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(2);
    });

    it('returns findings if token balance changes', async () => {
      // set a token balance for the contract
      const oldValue = ethers.BigNumber.from(0);
      const newValue = ethers.BigNumber.from(1);
      mockContract.balanceOf = jest.fn()
        .mockResolvedValueOnce(oldValue)
        .mockResolvedValueOnce(newValue);

      // invoke the block handler
      let findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(1);

      // invoke the transaction handler
      const receipt = { logs: logsNoMatchEvent };
      const mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a second time
      findings = await handleBlock();

      // create expected findings
      const { alertFields, address: protocolAddress } = initializeData;
      const { protocolName, protocolAbbreviation, developerAbbreviation } = alertFields;

      const expectedFindings = [Finding.fromObject({
        name: `${protocolName} DAO Treasury MultiSig - Token Balance Changed`,
        description: `Token balance of ${protocolAddress} changed by 1`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-TOKEN-BALANCE-CHANGE`,
        protocol: 'ethereum',
        severity: FindingSeverity.Info,
        type: FindingType.Info,
        metadata: {
          tokenAddress: mockTokenAddress,
          previousBalance: oldValue.toString(),
          newBalance: newValue.toString(),
        },
      })];

      expect(findings).toStrictEqual(expectedFindings);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(2);
    });

    it('returns empty findings if a new token is transferred to the wallet but the balance remains unchanged', async () => {
      mockContract.balanceOf = jest.fn()
        .mockResolvedValueOnce(ethers.BigNumber.from(0)) // original token, first call
        .mockResolvedValueOnce(ethers.BigNumber.from(0)) // original token, second call
        .mockResolvedValueOnce(ethers.BigNumber.from(0)) // new token, first call
        .mockResolvedValueOnce(ethers.BigNumber.from(0)) // original token, third call
        .mockResolvedValueOnce(ethers.BigNumber.from(0)); // new token, second call

      // invoke the block handler
      let findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(1);

      // get the address of the wallet
      const { address } = initializeData;

      // create the log with the Transfer event inside
      const topics = erc20Interface.encodeFilterTopics('Transfer', [
        ethers.constants.AddressZero,
        address,
      ]);
      const logsNewTransferToEvent = [
        {
          address: mockNewTokenAddress,
          topics,
          data: ethers.constants.HashZero,
        },
      ];
      let receipt = { logs: logsNewTransferToEvent };
      let mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);

      // invoke the transaction handler
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a second time
      // this should result in a call to the balanceOf method of the new token
      findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(3);

      receipt = { logs: logsNoMatchEvent };
      mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);

      // invoke the transaction handler again, this time without a Transfer event
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a third time
      // this should result in a second call ot the balanceOf method of the new token
      findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(5);
    });

    it('returns findings if a new token is transferred to the wallet and the balance changes', async () => {
      const oldValue = ethers.BigNumber.from(0);
      const newValue = ethers.BigNumber.from(1);
      mockContract.balanceOf = jest.fn()
        .mockResolvedValueOnce(ethers.BigNumber.from(0)) // original token, first call
        .mockResolvedValueOnce(ethers.BigNumber.from(0)) // original token, second call
        .mockResolvedValueOnce(oldValue) // new token, first call
        .mockResolvedValueOnce(ethers.BigNumber.from(0)) // original token, third call
        .mockResolvedValueOnce(newValue); // new token, second call

      // invoke the block handler
      let findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(1);

      // get the address of the wallet
      const { address } = initializeData;

      // create the log with the Transfer event inside
      const topics = erc20Interface.encodeFilterTopics('Transfer', [
        ethers.constants.AddressZero,
        address,
      ]);
      const logsNewTransferToEvent = [
        {
          address: mockNewTokenAddress,
          topics,
          data: ethers.constants.HashZero,
        },
      ];
      let receipt = { logs: logsNewTransferToEvent };
      let mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);

      // invoke the transaction handler
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a second time
      // this should result in a call to the balanceOf method of the new token
      findings = await handleBlock();
      expect(findings).toStrictEqual([]);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(3);

      receipt = { logs: logsNoMatchEvent };
      mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);

      // invoke the transaction handler again, this time without a Transfer event
      findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);

      // invoke the block handler a third time
      // this should result in a second call ot the balanceOf method of the new token
      findings = await handleBlock();

      // create expected findings
      const { alertFields, address: protocolAddress } = initializeData;
      const { protocolName, protocolAbbreviation, developerAbbreviation } = alertFields;
      const expectedFindings = [Finding.fromObject({
        name: `${protocolName} DAO Treasury MultiSig - Token Balance Changed`,
        description: `Token balance of ${protocolAddress} changed by 1`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-TOKEN-BALANCE-CHANGE`,
        protocol: 'ethereum',
        severity: FindingSeverity.Info,
        type: FindingType.Info,
        metadata: {
          tokenAddress: mockTokenAddress,
          previousBalance: oldValue.toString(),
          newBalance: newValue.toString(),
        },
      })];

      expect(findings).toStrictEqual(expectedFindings);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(5);
    });
  });

  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;

    const { version } = config.gnosisSafe;
    // eslint-disable-next-line import/no-dynamic-require,global-require
    const { abi } = require(`../abi/${version}/gnosis_safe.json`);
    const iface = new ethers.utils.Interface(abi);

    const logsNoMatchEvent = [
      {
        address: '0xINVALIDADDRESS',
        topics: [ethers.constants.HashZero],
      },
    ];

    const logsAddressMatchNoEventMatch = [
      {
        address: config.gnosisSafe.address,
        topics: [ethers.constants.HashZero],
      },
    ];

    const topics = iface.encodeFilterTopics('AddedOwner', []);
    const logsAddressAndEventMatch = [
      {
        address: config.gnosisSafe.address,
        topics,
        data: ethers.constants.HashZero,
      },
    ];

    beforeEach(async () => {
      // set an initial Ether balance for the contract
      mockProvider.getBalance = jest.fn().mockResolvedValue(ethers.BigNumber.from(0));

      initializeData = {};
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);
    });

    it('returns empty findings if the address does not match', async () => {
      // invoke the transaction handler with a non-matching log
      const receipt = { logs: logsNoMatchEvent };
      const mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if the address matches but the event does not', async () => {
      // invoke the transaction handler with a non-matching log
      const receipt = { logs: logsAddressMatchNoEventMatch };
      const mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns findings if the address and event match', async () => {
      // invoke the transaction handler with a non-matching log
      const receipt = { logs: logsAddressAndEventMatch };
      const mockTxEvent = new TransactionEvent(null, null, null, receipt, [], [], null);
      const findings = await handleTransaction(mockTxEvent);

      // create expected findings
      const { alertFields, address: protocolAddress } = initializeData;
      const { protocolName, protocolAbbreviation, developerAbbreviation } = alertFields;
      const expectedFindings = [Finding.fromObject({
        name: `${protocolName} DAO Treasury MultiSig - AddedOwner`,
        description: `Owner added to Gnosis-Safe MultiSig wallet: ${ethers.constants.AddressZero}`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-ADDED-OWNER`,
        protocol: 'ethereum',
        severity: FindingSeverity.Info,
        type: FindingType.Info,
        metadata: {
          address: protocolAddress,
          owner: ethers.constants.AddressZero,
        },
      })];
      expect(findings).toStrictEqual(expectedFindings);
    });
  });
});
