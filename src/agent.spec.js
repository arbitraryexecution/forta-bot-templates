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
      handleBlock: jest.fn().mockResolvedValue([blockFinding]),
    });

    const blockFindings = await handleBlock(mockBlockEvent);
    expect(blockFindings).toStrictEqual([blockFinding]);

    const txFinding = 'mockedFinding2';
    botMap.set('address-watch', {
      handleTransaction: jest.fn().mockResolvedValue([txFinding]),
    });

    const handleTransaction = handleAllTransactions(botMap, botStates);
    const txFindings = await handleTransaction(mockTxEvent);
    expect(txFindings).toStrictEqual([txFinding]);
  });
});

describe('test multi-bot initializer', () => {
  it('should add any bots that match the botImports Array', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
      bots: [
        {
          botType: 'account-balance',
          name: 'bot_1',
          contracts: {
            contractName: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
        {
          botType: 'address-watch',
          name: 'bot_2',
          contracts: {
            contractName: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
      ],
    };
    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    expect(botStates.bots.length).toStrictEqual(2);
  });

  it('should fail when trying to add a bot that is not in the botImports Array', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
      bots: [
        {
          botType: 'account-balance',
          name: 'bot_1',
          contracts: {
            contractName: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              thresholdEth: 0,
              type: 'Info',
              severity: 'Info',
            },
          },
          alertMinimumIntervalSeconds: 86400,
        },
        {
          botType: 'address-watch',
          name: 'bot_2',
          contracts: {
            contractName: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
        {
          botType: 'invalid-bot-type',
          name: 'bot_3',
          contracts: {
            contractName: {
              address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              type: 'Info',
              severity: 'Info',
            },
          },
        },
      ],
    };

    const botStates = {};
    const botMap = new Map();

    try {
      await (initializeBots(config, botMap, botStates))();
    } catch (error) {
      expect(error.name).toStrictEqual('TypeError');
      expect(error.message.startsWith('Cannot read properties of undefined')).toStrictEqual(true);
    }
  });
});

describe('test multi-agents with gather mode all', () => {
  it('returns no findings if the transaction handler is not met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
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

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;

    const handleBlocks = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlocks(mockBlockEvent);
    expect(blockFindings).toStrictEqual([]);

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    const handleTransactions = handleAllTransactions(botMap, botStates);
    const findings = await handleTransactions(mockTxEvent);
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if the transaction handler condition is met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
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

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();

    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;
    const handleBlocks = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlocks(mockBlockEvent);
    expect(blockFindings).toStrictEqual([]);

    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;
    const handleTransactions = handleAllTransactions(botMap, botStates);

    const finding = 'mockedFinding1';
    botMap.set('address-watch', {
      handleTransaction: jest.fn().mockResolvedValue([finding]),
    });

    const findings = await handleTransactions(mockTxEvent);
    expect(findings).toStrictEqual([finding]);
  });

  it('returns no findings when the block handler condition is not met', async () => {
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
    mockBlockEvent.transactions = [];

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);
    const findings = await handleBlock(mockBlockEvent);
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if a block condition handler is met', async () => {
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
    mockBlockEvent.transactions = [];

    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();
    const handleBlock = handleAllBlocks(botMap, botStates);

    const finding = 'mockedFinding1';
    botMap.set('account-balance', {
      handleBlock: jest.fn().mockResolvedValue([finding]),
    });

    const findings = await handleBlock(mockBlockEvent);
    expect(findings).toStrictEqual([finding]);
  });

  it('returns no findings if the block handler condition is met but the transaction handler condition is not met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
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

    // initialize
    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();

    // set up the blockEvent
    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;
    mockBlockEvent.transactions = [1];

    // run the block handler
    const handleBlock = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlock(mockBlockEvent);

    // force the mocked finding to be returned from the block handler
    const finding = 'mockedFinding1';
    botMap.set('account-balance', {
      handleBlock: jest.fn().mockResolvedValue([finding]),
    });

    // check that the block handler returns no findings
    expect(blockFindings).toStrictEqual([]);

    // set up the transactionEvent
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    // run the transaction handler
    const handleTransactions = handleAllTransactions(botMap, botStates);
    const transactionFindings = await handleTransactions(mockTxEvent);

    // check that the transaction handler returns no findings
    expect(transactionFindings).toStrictEqual([]);
  });

  it('returns no findings if the block handler condition is not met but the transaction handler condition is met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
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

    // initialize
    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();

    // set up the blockEvent
    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;
    mockBlockEvent.transactions = [1];

    // run the block handler
    const handleBlock = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlock(mockBlockEvent);

    // check that the block handler returns no findings
    expect(blockFindings).toStrictEqual([]);

    // set up the transactionEvent
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    // force the transaction handler to return the mocked finding
    const finding = 'mockedFinding1';
    botMap.set('address-watch', {
      handleTransaction: jest.fn().mockResolvedValue([finding]),
    });

    // run the transaction handler
    const handleTransactions = handleAllTransactions(botMap, botStates);
    const transactionFindings = await handleTransactions(mockTxEvent);

    // check that the transaction handler returns no findings
    expect(transactionFindings).toStrictEqual([]);
  });

  it('returns no findings if the block handler condition is not met and the transaction handler condition is not met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
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

    // initialize
    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();

    // set up the blockEvent
    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;
    mockBlockEvent.transactions = [1];

    // run the block handler
    const handleBlock = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlock(mockBlockEvent);

    // check that the block handler returns no findings
    expect(blockFindings).toStrictEqual([]);

    // set up the transactionEvent
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    // run the transaction handler
    const handleTransactions = handleAllTransactions(botMap, botStates);
    const transactionFindings = await handleTransactions(mockTxEvent);

    // check that the transaction handler returns no findings
    expect(transactionFindings).toStrictEqual([]);
  });

  it('returns findings if the block handler condition is met and the transaction handler condition is met', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'all',
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

    // initialize
    const botStates = {};
    const botMap = new Map();
    await (initializeBots(config, botMap, botStates))();

    // set up the blockEvent
    const mockBlockEvent = createBlockEvent({});
    mockBlockEvent.block = block;
    mockBlockEvent.transactions = [1];

    // force the mocked finding to be returned from the block handler
    const mockedBlockFinding = 'mockedFinding1';
    botMap.set('account-balance', {
      handleBlock: jest.fn().mockResolvedValue([mockedBlockFinding]),
    });

    // run the block handler
    const handleBlock = handleAllBlocks(botMap, botStates);
    const blockFindings = await handleBlock(mockBlockEvent);

    // check that the block handler returns no findings
    expect(blockFindings).toStrictEqual([]);

    // set up the transactionEvent
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.block = block;

    // force the transaction handler to return the mocked finding
    const mockedTransactionFinding = 'mockedFinding2';
    botMap.set('address-watch', {
      handleTransaction: jest.fn().mockResolvedValue([mockedTransactionFinding]),
    });

    // run the transaction handler
    const handleTransactions = handleAllTransactions(botMap, botStates);
    const transactionFindings = await handleTransactions(mockTxEvent);

    // check that the transaction handler returns no findings
    expect(transactionFindings).toStrictEqual([mockedBlockFinding, mockedTransactionFinding]);
  });
});
