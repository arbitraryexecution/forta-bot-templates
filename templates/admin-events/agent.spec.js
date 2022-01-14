const template = require('./template.json');

const {
  Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize } = require('./agent');

// retrieve a contract by name from the list of initialized contracts
function getContractByName(contracts, name) {
  const matches = contracts.filter((contract) => contract.name === name);
  if (matches.length !== 1) {
    if (matches.length === 0) {
      throw new Error(`No matching contract found with name ${name}`);
    } else {
      throw new Error(`Multiple matching contracts found with name ${name}`);
    }
  }

  return matches[0];
}

// tests
describe('admin event monitoring', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;

    beforeEach(async () => {
      initializeData = {};

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);
    });

    it('returns empty findings if contract address does not match', async () => {
      // logs data for test case:  no address match + no topic match
      const logsNoMatchAddress = [
        {
          address: ethers.constants.AddressZero,
          topics: [
            ethers.constants.HashZero,
          ],
        },
      ];

      // build transaction event
      const txEvent = createTransactionEvent({
        receipt: { logs: logsNoMatchAddress },
        addresses: { [ethers.constants.AddressZero]: true },
      });

      // run agent
      const findings = await handleTransaction(txEvent);

      // assertions
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address matches but not event', async () => {
      const { contracts } = initializeData;

      // retrieve the Object corresponding to a contract with event monitoring
      const monitoredContract = getContractByName(contracts, template.firstMonitoredContractName);
      const monitoredContractAddress = monitoredContract.address.toLowerCase();

      // TODO: Log topics will depend upon event information
      // logs data for test case: address match + no topic match
      const logsNoMatchEvent = [
        {
          address: monitoredContractAddress,
          topics: [
            monitoredContract.iface.getEventTopic(template.firstContractUnmonitoredEvent),
            ethers.constants.HashZero, // voter address
          ],
          // create a large dummy array to give ethers.parseLog() something to decode
          data: `0x${'0'.repeat(1000)}`,
        },
      ];

      // build transaction event
      const txEvent = createTransactionEvent({
        receipt: { logs: logsNoMatchEvent },
        addresses: { [monitoredContractAddress]: true },
      });

      // run agent
      const findings = await handleTransaction(txEvent);

      // assertions
      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if a target contract emits an event from its watchlist', async () => {
      const { contracts } = initializeData;

      // retrieve the Object corresponding to another monitored contract
      const monitoredContract = getContractByName(contracts, secondMonitoredContractName);
      const monitoredContractAddress = monitoredContract.address.toLowerCase();

      // TODO: Log topics will depend upon event information
      // logs data for test case: address match + topic match (should trigger a finding)
      const logsMatchEvent = [
        {
          address: monitoredContractAddress,
          topics: [
            monitoredContract.iface.getEventTopic(secondContractMonitoredEvent),
            `${(ethers.constants.HashZero).slice(0, -1)}1`, // old owner address  0x0000...0001
            `${(ethers.constants.HashZero).slice(0, -1)}2`, // new owner address  0x0000...0002
          ],
          data: '0x',
        },
      ];

      // build transaction event
      const txEvent = createTransactionEvent({
        receipt: { logs: logsMatchEvent },
        addresses: { [monitoredContractAddress]: true },
      });

      // run agent
      const findings = await handleTransaction(txEvent);

      // create expected finding
      const testFindings = [Finding.fromObject({
        name: template.findingName,
        description: template.findingDescription,
        alertId: template.alertId,
        type: template.FindingType.Suspicious,
        severity: FindingSeverity.High,
        everestId: template.everestId,
        protocol: template.protocol,
        metadata: {
          contractName: template.secondMonitoredContractName,
          contractAddress: monitoredContractAddress,
          eventName: template.secondContractMonitoredEvent,
          oldOwner: '0x0000000000000000000000000000000000000001',
          newOwner: '0x0000000000000000000000000000000000000002',
        },
      })];

      expect(findings).toStrictEqual(testFindings);
    });
  });
});
