const {
  ethers,
  createTransactionEvent,
  Finding,
  FindingType,
  FindingSeverity,
} = require('forta-agent');

const {
  initialize,
  handleTransaction
} = require('./agent');

const config = {
  developerAbbreviation: "DEVTEST",
  protocolName: "PROTOTEST",
  protocolAbbreviation: "PT",
  botType: "address-watch",
  name: "test-bot",
  contracts: {
    contractName1: {
      name: "accountName1",
      address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
      watch : {
        type: "Info",
        severity: "Info"
      }
    }
  }
};

describe('handleTransaction', () => {
  let botState;
  beforeEach(async () => {
    botState = await initialize(config);
  });

  it('returns empty findings if no address match is found', async () => {
    // build txEvent
    const txEvent = createTransactionEvent({
      addresses: {},
    });
    txEvent.addresses[ethers.constants.AddressZero] = true;

    // run bot with txEvent
    const findings = await handleTransaction(botState, txEvent);

    // assertions
    expect(findings).toStrictEqual([]);
  });

  it('returns a finding if a transaction participant is on the watch list', async () => {
    const testAddr = Object.values(config.contracts)[0].address;
    const params = Object.values(config.contracts)[0];

    // build txEvent
    const txEvent = createTransactionEvent({
      addresses: {},
    });
    txEvent.addresses[testAddr] = true;

    // run bot with txEvent
    const findings = await handleTransaction(botState, txEvent);

    // assertions
    expect(findings).toStrictEqual([
      Finding.fromObject({
        name: `${botState.protocolName} Address Watch`,
        description: `Address ${testAddr} (${params.name}) was involved in a transaction`,
        alertId: `${botState.developerAbbreviation}-${botState.protocolAbbrev}-ADDRESS-WATCH`,
        type: FindingType[params.watch.type],
        severity: FindingSeverity[params.watch.severity],
      }),
    ]);
  });
});
