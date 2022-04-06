const {
  ethers,
  createTransactionEvent,
  Finding,
  FindingType,
  FindingSeverity,
} = require('forta-agent');

// local definitions
const { provideHandleBlock } = require('./agent');

// load config file
const config = require('../agent-config.json');

// load configuration data from agent config file
const {
  developerAbbreviation: developerAbbrev,
  protocolName,
  protocolAbbrev,
  accountBalance,
} = config;

// make sure addresses is populated
const accounts = Object.values(accountBalance);

// check the configuration file to verify the values
describe('check agent configuration file', () => {
  it('must supply at least one account to watch', () => {
    expect(accounts.length).not.toBe(0);
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
});
