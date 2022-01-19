const {
  ethers,
  createTransactionEvent,
} = require('forta-agent');

// local definitions
const { handleTransaction, createAlert } = require('./agent');

// load config file
const config = require('./agent-config.json');

// load configuration data from agent config file
const everestId = config.everestId || 'No Everest ID Specified';
const protocolName = config.protocolName || 'No Protocol Name Specified';
const protocolAbbrev = config.protocolAbbrev || 'NA';
const { addressList } = config;

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

    // build txEvent
    const txEvent = createTransactionEvent({
      addresses: {},
    });
    txEvent.addresses[testAddr] = true;

    // run agent with txEvent
    const findings = await handleTransaction(txEvent);

    // assertions
    expect(findings).toStrictEqual([
      createAlert(protocolName, testAddr, addressList[testAddr], protocolAbbrev, everestId),
    ]);
  });
});
