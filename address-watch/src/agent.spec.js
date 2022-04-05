const {
  ethers,
  createTransactionEvent,
  Finding,
  FindingType,
  FindingSeverity,
} = require('forta-agent');

// local definitions
const { handleTransaction } = require('./agent');

// load config file
const config = require('../agent-config.json');

// load configuration data from agent config file
const {
  developerAbbreviation: developerAbbrev,
  protocolName,
  protocolAbbrev,
  contracts,
} = config;

// make sure addresses is populated
const addresses = Object.values(contracts);
if (addresses.length === 0) {
  throw new Error('Must supply at least one address to watch');
}

// tests
describe('handleTransaction', () => {
  it('returns empty findings if no address match is found', async () => {
    // build txEvent
    const txEvent = createTransactionEvent({
      addresses: {},
    });
    txEvent.addresses[ethers.constants.AddressZero] = true;

    // run agent with txEvent
    const findings = await handleTransaction(txEvent);

    // assertions
    expect(findings).toStrictEqual([]);
  });

  it('returns a finding if a transaction participant is on the watch list', async () => {
    const testAddr = Object.values(contracts)[0].address;
    const params = Object.values(contracts)[0];

    // build txEvent
    const txEvent = createTransactionEvent({
      addresses: {},
    });
    txEvent.addresses[testAddr] = true;

    // run agent with txEvent
    const findings = await handleTransaction(txEvent);

    // assertions
    expect(findings).toStrictEqual([
      Finding.fromObject({
        name: `${protocolName} Address Watch`,
        description: `Address ${testAddr} (${params.name}) was involved in a transaction`,
        alertId: `${developerAbbrev}-${protocolAbbrev}-ADDRESS-WATCH`,
        type: FindingType[params.watch.type],
        severity: FindingSeverity[params.watch.severity],
      }),
    ]);
  });
});
