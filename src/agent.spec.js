const { createTransactionEvent, createBlockEvent } = require('forta-agent');

const {
  initializeBots,
  handleAllBlocks,
  handleAllTransactions,
} = require('./agent');

const block = {
  hash: `0x${'0'.repeat(64)}`,
  timestamp: new Date(),
};

describe('test multi-agents with gather mode any', () => {
  it('returns no findings when the respective tx handler condition is not met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'address-watch',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
      ],
    };

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleTransactions = handleAllTransactions(botMap, botStates);
    const findings = await handleTransactions(mockTxEvent);
    expect(findings).toStrictEqual([]);
  });

  it('returns a finding when the respective tx handler condition is met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'address-watch',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
      ],
    };

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;
    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleTransactions = handleAllTransactions(botMap, botStates);

    const finding = 'mockedFinding1';
    botMap.set('address-watch', {
      validateConfig: jest.fn(),
      initialize: jest.fn(),
      handleTransaction: jest.fn().mockResolvedValue([finding]),
    });

    const findings = await handleTransactions(mockTxEvent);
    expect(findings).toStrictEqual([finding]);
  });

  it('returns no findings when the respective block handler condition is not met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);
    const findings = await handleBlock(mockBlockEvent);
    expect(findings).toStrictEqual([]);
  });

  it('returns a finding when the respective block handler condition is met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);

    const finding = 'mockedFinding1';
    botMap.set('account-balance', {
      validateConfig: jest.fn(),
      initialize: jest.fn(),
      handleBlock: jest.fn().mockResolvedValue([finding]),
    });

    const findings = await handleBlock(mockBlockEvent);
    expect(findings).toStrictEqual([finding]);
  });

  it('returns no findings when the respective block and tx handler conditions are not met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'address-watch',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlock(mockBlockEvent);
    expect(blockFindings).toStrictEqual([]);

    const handleTransaction = handleAllTransactions(botMap, botStates);
    const txFindings = await handleTransaction(mockTxEvent);
    expect(txFindings).toStrictEqual([]);
  });

  it('returns a block finding when the respective block handler condition is met but not the tx handler', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'address-watch',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);

    const blockFinding = 'mockedFinding1';
    botMap.set('account-balance', {
      validateConfig: jest.fn(),
      initialize: jest.fn(),
      handleBlock: jest.fn().mockResolvedValue([blockFinding]),
    });

    const blockFindings = await handleBlock(mockBlockEvent);
    expect(blockFindings).toStrictEqual([blockFinding]);

    const handleTransaction = handleAllTransactions(botMap, botStates);
    const txFindings = await handleTransaction(mockTxEvent);
    expect(txFindings).toStrictEqual([]);
  });

  it('returns a tx finding when the respective tx handler condition is met but not the block handler', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'address-watch',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlock(mockBlockEvent);
    expect(blockFindings).toStrictEqual([]);

    const txFinding = 'mockedFinding1';
    botMap.set('address-watch', {
      validateConfig: jest.fn(),
      initialize: jest.fn(),
      handleTransaction: jest.fn().mockResolvedValue([txFinding]),
    });

    const handleTransaction = handleAllTransactions(botMap, botStates);
    const txFindings = await handleTransaction(mockTxEvent);
    expect(txFindings).toStrictEqual([txFinding]);
  });

  it('returns a block and tx finding when the respective block and tx handler conditions are met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
      bots: [
        {
          botType: 'address-watch',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);

    const blockFinding = 'mockedFinding1';
    botMap.set('account-balance', {
      validateConfig: jest.fn(),
      initialize: jest.fn(),
      handleBlock: jest.fn().mockResolvedValue([blockFinding]),
    });

    const blockFindings = await handleBlock(mockBlockEvent);
    expect(blockFindings).toStrictEqual([blockFinding]);

    const txFinding = 'mockedFinding2';
    botMap.set('address-watch', {
      validateConfig: jest.fn(),
      initialize: jest.fn(),
      handleTransaction: jest.fn().mockResolvedValue([txFinding]),
    });

    const handleTransaction = handleAllTransactions(botMap, botStates);
    const txFindings = await handleTransaction(mockTxEvent);
    expect(txFindings).toStrictEqual([txFinding]);
  });
});

describe('test multi-agents with gather mode all', () => {
  it('test transactions only', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
      bots: [
        {
          botType: 'governance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              abiFile: 'Governor',
            },
          },
        },
      ],
    };

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleTransactions = handleAllTransactions(botMap, botStates);
    await handleTransactions(mockTxEvent);
  });

  it('test blocks only', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
      bots: [
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);
    await handleBlock(mockBlockEvent);
  });

  it('test tx and blocks', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
      bots: [
        {
          botType: 'governance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              abiFile: 'Governor',
            },
          },
        },
        {
          botType: 'account-balance',
          name: 'test',
          contracts: {
            contractName1: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
      ],
    };

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);
    await handleBlock(mockBlockEvent);

    const handleTransaction = handleAllTransactions(botMap, botStates);
    await handleTransaction(mockTxEvent);
  });
});
