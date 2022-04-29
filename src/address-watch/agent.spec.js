const {
  ethers,
  createTransactionEvent,
  Finding,
  FindingType,
  FindingSeverity,
} = require('forta-agent');

const tests = async (config, module) => {
  // make sure addresses is populated
  const addresses = Object.values(config.contracts);
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
      const findings = await module.handleTransaction(config, txEvent);

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
      const findings = await module.handleTransaction(config, txEvent);

      // assertions
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: `${state.protocolName} Address Watch`,
          description: `Address ${testAddr} (${params.name}) was involved in a transaction`,
          alertId: `${state.developerAbbreviation}-${state.protocolAbbrev}-ADDRESS-WATCH`,
          type: FindingType[params.watch.type],
          severity: FindingSeverity[params.watch.severity],
        }),
      ]);
    });
  });
};

module.exports = {
  tests,
};
