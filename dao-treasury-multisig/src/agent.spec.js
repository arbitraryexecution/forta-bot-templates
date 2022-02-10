const mockContract = {};

jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    providers: {
      JsonRpcBatchProvider: jest.fn(),
    },
    Contract: jest.fn().mockReturnValue(mockContract),
  },
}));

const config = require('../agent-config.json');

const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
} = require('forta-agent');

const { provideHandleBlock, provideHandleTransaction, provideInitialize } = require('./agent');

describe('check agent configuration file', () => {
  it('procotolName key required', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('gnosisSafe key required', () => {
    const { gnosisSafe } = config;
    expect(typeof (gnosisSafe)).toBe('object');
    expect(gnosisSafe).not.toBe({});
  });

  it('gnosisSafe key values must be valid', () => {
    const { gnosisSafe } = config;
    const { address, version } = gnosisSafe;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // check that there is a corresponding file for the version indicated
    // eslint-disable-next-line import/no-dynamic-require,global-require
    const { abi } = require(`../abi/${version}/gnosis_safe.json`);

    expect(typeof (abi)).toBe('object');
    expect(abi).not.toBe({});
  });
});

describe('gnosis-safe multisig monitoring', () => {
  describe('handleTransaction', () => {
    it('returns a finding if gas used is above threshold', async () => {
    });
  });
});
