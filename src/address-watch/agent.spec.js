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
  agentType: "address-watch",
  name: "test-agent",
  addressList: {
    0xFe1A6056EE03235f30f7a48407A5673BBf25eD48: {
      name: "AaveDeployer",
      type: "Info",
      severity: "Info"
    }
  }
};

describe('handleTransaction', () => {
  let agentState;
  beforeEach(async () => {
    agentState = await initialize(config);
  });

  it('returns empty findings if no address match is found', async () => {
    // build txEvent
    const txEvent = createTransactionEvent({
      addresses: {},
    });
    txEvent.addresses[ethers.constants.AddressZero] = true;

    // run agent with txEvent
    const findings = await handleTransaction(agentState, txEvent);

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

    // run agent with txEvent
    const findings = await handleTransaction(agentState, txEvent);

    // assertions
    expect(findings).toStrictEqual([
      Finding.fromObject({
        name: `${agentState.protocolName} Address Watch`,
        description: `Address ${testAddr} (${params.name}) was involved in a transaction`,
        alertId: `${agentState.developerAbbreviation}-${agentState.protocolAbbrev}-ADDRESS-WATCH`,
        type: FindingType[params.watch.type],
        severity: FindingSeverity[params.watch.severity],
      }),
    ]);
  });
});
