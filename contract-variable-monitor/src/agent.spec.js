const {
  Finding, FindingType, FindingSeverity, ethers,
} = require('forta-agent');

const { provideHandleBlock, provideInitialize } = require('./agent');
const { getObjectsFromAbi, getEventFromConfig } = require('./test-utils');
const utils = require('./utils');
const config = require('../agent-config-test.json');

// check the configuration file to verify the values
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

  it('contracts key required', () => {
    const { contracts } = config;
    expect(typeof (contracts)).toBe('object');
    expect(contracts).not.toBe({});
  });

  it('contracts key values must be valid', () => {
    const { contracts } = config;
    Object.keys(contracts).forEach((key) => {
      const { address, abiFile, variables } = contracts[key];

      // check that the address is a valid address
      expect(ethers.utils.isHexString(address, 20)).toBe(true);

      // load the ABI from the specified file
      // the call to getAbi will fail if the file does not exist
      const abi = utils.getAbi(abiFile);

      // get all of the function objects from the loaded ABI file
      const functionObjects = getObjectsFromAbi(abi, 'function');

      // for all of the variable names specified, verify that their corresponding getter function
      // exists in the ABI
      Object.keys(variables).forEach((variableName) => {
        expect(Object.keys(functionObjects).indexOf(variableName)).not.toBe(-1);

        // extract the keys from the configuration file for a specific function
        const {
          type,
          severity,
          upperThresholdPercent,
          lowerThresholdPercent,
          numDataPoints,
        } = variables[variableName];

        // check type, this will fail if 'type' is not valid
        expect(Object.prototype.hasOwnProperty.call(FindingType, type)).toBe(true);

        // check severity, this will fail if 'severity' is not valid
        expect(Object.prototype.hasOwnProperty.call(FindingSeverity, severity)).toBe(true);

        // make sure there is at least one threshold value present in the config, otherwise fail
        if (upperThresholdPercent === null && lowerThresholdPercent === null) {
          throw new Error('Either the upperThresholdPercent or lowerThresholdPercent for the'
            + ` variable ${variableName} must be defined`);
        }

        // if upperThresholdPercent is defined, make sure the value is a number
        if (upperThresholdPercent !== null) {
          expect(upperThresholdPercent).toEqual(expect.any(Number));
        }

        // if lowerThresholdPercent is defined, make sure the value is a number
        if (lowerThresholdPercent !== null) {
          expect(lowerThresholdPercent).toEqual(expect.any(Number));
        }

        // make sure value for numDataPoints in config is a number
        expect(numDataPoints).toEqual(expect.any(Number));
      });
    });
  });
});
