const { createTransactionEvent, createBlockEvent } = require('forta-agent');

const {
  initializeBots,
  handleAllBlocks,
  handleAllTransactions,
} = require('./agent');

const block = {
  hash: `0x${'0'.repeat(20)}`,
  timestamp: new Date(),
};

describe('test multi-agents with gather mode any', () => {
  it('test transactions only', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
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

    const { initBotStates, initBotMap } = await initializeBots(config);
    const handleTransactions = handleAllTransactions(initBotMap, initBotStates);
    await handleTransactions(mockTxEvent);
  });

  it('test blocks only', async () => {
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

    const { initBotStates, initBotMap } = await initializeBots(config);
    const handleBlock = handleAllBlocks(initBotMap, initBotStates);
    await handleBlock(mockBlockEvent);
  });

  it('test tx and blocks', async () => {
    const config = {
      developerAbbreviation: 'test',
      protocolName: 'test',
      protocolAbbreviation: 'test',
      gatherMode: 'any',
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

    const { initBotStates, initBotMap } = await initializeBots(config);
    const handleBlock = handleAllBlocks(initBotMap, initBotStates);
    await handleBlock(mockBlockEvent);

    const handleTransaction = handleAllTransactions(initBotMap, initBotStates);
    await handleTransaction(mockTxEvent);
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

    const { initBotStates, initBotMap } = await initializeBots(config);
    const handleTransactions = handleAllTransactions(initBotMap, initBotStates);
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

    const { initBotStates, initBotMap } = await initializeBots(config);
    const handleBlock = handleAllBlocks(initBotMap, initBotStates);
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

    const { initBotStates, initBotMap } = await initializeBots(config);
    const handleBlock = handleAllBlocks(initBotMap, initBotStates);
    await handleBlock(mockBlockEvent);

    const handleTransaction = handleAllTransactions(initBotMap, initBotStates);
    await handleTransaction(mockTxEvent);
  });
});
