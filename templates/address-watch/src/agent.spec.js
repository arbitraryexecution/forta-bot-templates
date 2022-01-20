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
const config = require('./agent-config.json');

// load configuration data from agent config file
const developerAbbrev = config.developerAbbreviation;
const { everestId } = config;
const { protocolName } = config;
const { protocolAbbrev } = config;

// get list of addresses to watch
const { addressList } = config;
const addresses = Object.keys(addressList);
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
    const testAddr = Object.keys(addressList)[0];
    const params = addressList[testAddr];

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
        type: FindingType[params.type],
        severity: FindingSeverity[params.severity],
        everestId,
      }),
    ]);
  });
});
