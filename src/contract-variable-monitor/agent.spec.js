const mockContract = {};

// combine the mocked provider and contracts into the ethers import mock
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

const {
  Finding, FindingType, FindingSeverity, ethers,
} = require('forta-agent');

const {
  initialize,
  handleBlock
} = require('./agent');

const {
  getObjectsFromAbi, getFunctionFromConfig, getRandomCharacterString,
} = require('../test-utils');
const utils = require('../utils');

const checkThresholdSpy = jest.spyOn(utils, 'checkThreshold');

const config = {
  developerAbbreviation: "DEVTEST",
  protocolName: "PROTOTEST",
  protocolAbbreviation: "PT",
  agentType: "admin-events",
  name: "test-agent",
  contracts: {
    UniswapV3Pool: {
      address: "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
      abiFile: "test-abi",
      variables: {
        liquidity: {
          type: "Info",
          severity: "Low",
          upperThresholdPercent: 15,
          lowerThresholdPercent: 5,
          numDataPoints: 3
        }
      }
    }
  }
};

const abiOverride = {
  "test-abi": [
    {
      inputs: [],
      name: "liquidity",
      outputs: [
        {
          internalType: "uint128",
          name: "",
          type: "uint128"
        }
      ],
      stateMutability: "view",
      type: "function"
    }
  ]
};

describe('monitor contract variables', () => {
  describe('handleBlock', () => {
    let agentState;
    let configContracts;
    let contractName;
    let validContractAddress;
    let abi;
    let functionObjects;
    let functionInConfig;
    let functionNotInConfig;
    let testConfig;
    let fakeFunctionName;

    beforeEach(async () => {
      // set up test configuration parameters that won't change with each test
      // grab the first entry from the 'contracts' key in the configuration file
      ({ contracts: configContracts } = config);
      [contractName] = Object.keys(configContracts);
      const { abiFile, variables } = configContracts[contractName];
      validContractAddress = configContracts[contractName].address;
      abi = [...abiOverride[abiFile]];
      functionObjects = getObjectsFromAbi(abi, 'function');

      // update the mock contract to include the contract address specified in the config
      mockContract.address = validContractAddress;

      fakeFunctionName = getRandomCharacterString(16);
      while (Object.keys(functionObjects).indexOf(fakeFunctionName) !== -1) {
        fakeFunctionName = getRandomCharacterString(16);
      }

      // add a fake function to the ABI in preparation for a negative test case
      // do this before creating an ethers Interface with the ABI
      abi.push({
        inputs: [
          { internalType: 'uint256', name: 'fakeInput0', type: 'uint256' },
          { internalType: 'uint256', name: 'fakeInput1', type: 'uint256' },
          { internalType: 'address', name: 'fakeInput1', type: 'address' },
        ],
        name: fakeFunctionName,
        outputs: [
          { internalType: 'uint256', name: 'fakeOutput0', type: 'uint256' },
          { internalType: 'address', name: 'fakeOutput1', type: 'address' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      });

      // retrieve a function object from the ABI corresponding to a monitored function
      // also retrieve the fake function that we know will be unmonitored
      testConfig = getFunctionFromConfig(abi, variables, fakeFunctionName);

      ({ functionInConfig, functionNotInConfig } = testConfig);

      // initialize the handler
      agentState = await initialize(config, abiOverride);
    });

    it('invokes the function specified by the variable name in the config and does not invoke any other functions in the contract ABI', async () => {
      agentState.variableInfoList.forEach((variableInfo) => {
        // add new mocked functions to the mockContract corresponding to the variable names for
        // getter functions found in the config file, the value is not important for this test
        mockContract[variableInfo.name] = jest.fn().mockResolvedValue(10);

        // make sure that minNumElements for each object in the initialized data's variableInfoList
        // is greater than 0 so that we can properly run this test
        if (variableInfo.minNumElements === 0) {
          // eslint-disable-next-line no-param-reassign
          variableInfo.minNumElements = 1;
        }
      });

      // now add a mocked function that we know was NOT in the config file, to make sure the test
      // only calls the functions specified in the config
      mockContract[functionNotInConfig.name] = jest.fn();

      await handleBlock(agentState);

      // make sure the agent called the getter function specified by a variable name in the config
      expect(mockContract[functionInConfig.name]).toHaveBeenCalledTimes(1);

      // make sure the agent did not call a function that was not specified by a variable name
      // in the config
      expect(mockContract[functionNotInConfig.name]).toHaveBeenCalledTimes(0);
    });

    it('does not invoke the checkThreshold function when not enough data points have been seen yet', async () => {
      agentState.variableInfoList.forEach((variableInfo) => {
        // add new mocked functions to the mockContract corresponding to the variable names for
        // getter functions found in the config file, the value is not important for this test
        mockContract[variableInfo.name] = jest.fn().mockResolvedValue(10);

        // make sure that minNumElements for each object in the initialized data's variableInfoList
        // is greater than 0 so that we can properly run this test
        if (variableInfo.minNumElements === 0) {
          // eslint-disable-next-line no-param-reassign
          variableInfo.minNumElements = 1;
        }
      });

      await handleBlock(agentState);

      // make sure the agent called the getter function specified by a variable name in the config
      expect(mockContract[functionInConfig.name]).toHaveBeenCalledTimes(1);

      // make sure the agent did not attempt to check if a percent change occurred  since we have
      // not seen enough blocks yet
      expect(checkThresholdSpy).toHaveBeenCalledTimes(0);
    });

    it('invokes the checkThreshold function when we have seen enough data points', async () => {
      /* eslint-disable no-param-reassign */
      // make sure there is only one variable in the list so we can accurately test the number of
      // function calls made
      agentState.variableInfoList = [agentState.variableInfoList[0]];
      const [variableInfo] = agentState.variableInfoList;

      // set the minNumElements to be 1
      variableInfo.minNumElements = 1;

      // make sure upperThresholdPercent is defined for this test
      variableInfo.lowerThresholdPercent = 1;
      /* eslint-enable no-param-reassign */

      // add new mocked functions to the mockContract corresponding to the variable names for getter
      // functions found in the config file
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(10);

      // run the agent once
      await handleBlock(agentState);

      // make sure the agent called the getter function specified by a variable name in the config
      expect(mockContract[functionInConfig.name]).toHaveBeenCalledTimes(1);

      // make sure the agent did not attempt to check if a percent change occurred since we have
      // not seen enough blocks yet
      expect(checkThresholdSpy).toHaveBeenCalledTimes(0);

      // update the value returned by the target getter function so that checkThreshold will be
      // called on the next agent invocation
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(11);

      // run the agent again now that we have seen the minimum number of data points
      await handleBlock(agentState);

      // make sure the agent called the getter function specified by a variable name in the config
      expect(mockContract[functionInConfig.name]).toHaveBeenCalledTimes(1);

      // now the agent should have run checkThreshold since we have seen enough data points
      expect(checkThresholdSpy).toHaveBeenCalledTimes(1);
    });

    it('returns a finding when the value increases and the change is greater than the upper threshold percent change', async () => {
      const newThresholdLimit = 10;
      const initialGetterValue = 10;
      /* eslint-disable no-param-reassign */
      // make sure there is only one variable in the list so we can accurately test the number of
      // function calls made
      agentState.variableInfoList = [agentState.variableInfoList[0]];
      const [variableInfo] = agentState.variableInfoList;

      // set the minNumElements to be 1
      variableInfo.minNumElements = 1;

      // make sure upperThresholdPercent is defined for this test
      variableInfo.upperThresholdPercent = newThresholdLimit;
      /* eslint-enable no-param-reassign */

      // add new mocked functions to the mockContract corresponding to the variable names for getter
      // functions found in the config file
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(initialGetterValue);

      // run the agent once
      await handleBlock(agentState);

      // update the value returned by the target getter function to be greater than the
      // upperThresholdPercent change
      const newValue = ((newThresholdLimit / 100) * initialGetterValue) + initialGetterValue + 1;
      const percentChange = ((newValue - initialGetterValue) / initialGetterValue) * 100;
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(newValue);

      // run the agent again now that we have seen the minimum number of data points
      const findings = await handleBlock(agentState);
      const expectedFinding = [Finding.fromObject({
        name: `${config.protocolName} Contract Variable`,
        description: `The ${functionInConfig.name} variable value in the ${contractName} contract`
          + ` had a change in value over the upper threshold limit of ${newThresholdLimit} percent`,
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-CONTRACT-VARIABLE`,
        type: FindingType[testConfig.findingType],
        severity: FindingSeverity[testConfig.findingSeverity],
        protocol: config.protocolName,
        metadata: {
          contractName,
          contractAddress: validContractAddress,
          variableName: functionInConfig.name,
          thresholdPosition: 'upper',
          thresholdPercentLimit: `${newThresholdLimit}`,
          actualPercentChange: `${percentChange}`,
        },
      })];

      expect(findings).toStrictEqual(expectedFinding);
    });

    it('does not return a finding when the value increases and the change is not greater than the upper threshold percent change', async () => {
      const newThresholdLimit = 100;
      const initialGetterValue = 10;
      /* eslint-disable no-param-reassign */
      // make sure there is only one variable in the list so we can accurately test the number of
      // function calls made
      agentState.variableInfoList = [agentState.variableInfoList[0]];
      const [variableInfo] = agentState.variableInfoList;

      // set the minNumElements to be 1
      variableInfo.minNumElements = 1;

      // make sure upperThresholdPercent is defined for this test
      variableInfo.upperThresholdPercent = newThresholdLimit;
      /* eslint-enable no-param-reassign */

      // add new mocked functions to the mockContract corresponding to the variable names for getter
      // functions found in the config file
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(initialGetterValue);

      // run the agent once
      await handleBlock(agentState);

      // update the value returned by the target getter function to be greater than the
      // upperThresholdPercent change
      const newValue = initialGetterValue + 1;
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(newValue);

      // run the agent again now that we have seen the minimum number of data points
      const findings = await handleBlock(agentState);
      expect(findings).toStrictEqual([]);
    });

    it('returns a finding when the value decreases more than the lower threshold percent change', async () => {
      const newThresholdLimit = 10;
      const initialGetterValue = 10;
      /* eslint-disable no-param-reassign */
      // make sure there is only one variable in the list so we can accurately test the number of
      // function calls made
      agentState.variableInfoList = [agentState.variableInfoList[0]];
      const [variableInfo] = agentState.variableInfoList;

      // set the minNumElements to be 1
      variableInfo.minNumElements = 1;

      // make sure lowerThresholdPercent is defined for this test
      variableInfo.lowerThresholdPercent = newThresholdLimit;
      /* eslint-enable no-param-reassign */

      // add new mocked functions to the mockContract corresponding to the variable names for getter
      // functions found in the config file
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(initialGetterValue);

      // run the agent once
      await handleBlock(agentState);

      // update the value returned by the target getter function to be greater than the
      // lowerThresholdPercent change
      const newValue = (initialGetterValue - ((newThresholdLimit / 100) * initialGetterValue)) - 1;
      const percentChange = ((initialGetterValue - newValue) / initialGetterValue) * 100;
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(newValue);

      // run the agent again now that we have seen the minimum number of data points
      const findings = await handleBlock(agentState);
      const expectedFinding = [Finding.fromObject({
        name: `${config.protocolName} Contract Variable`,
        description: `The ${functionInConfig.name} variable value in the ${contractName} contract`
          + ` had a change in value over the lower threshold limit of ${newThresholdLimit} percent`,
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-CONTRACT-VARIABLE`,
        type: FindingType[testConfig.findingType],
        severity: FindingSeverity[testConfig.findingSeverity],
        protocol: config.protocolName,
        metadata: {
          contractName,
          contractAddress: validContractAddress,
          variableName: functionInConfig.name,
          thresholdPosition: 'lower',
          thresholdPercentLimit: `${newThresholdLimit}`,
          actualPercentChange: `${percentChange}`,
        },
      })];

      expect(findings).toStrictEqual(expectedFinding);
    });

    it('does not return a finding when the value decreases and the change is not greater than the lower threshold percent change', async () => {
      const newThresholdLimit = 100;
      const initialGetterValue = 10;
      /* eslint-disable no-param-reassign */
      // make sure there is only one variable in the list so we can accurately test the number of
      // function calls made
      agentState.variableInfoList = [agentState.variableInfoList[0]];
      const [variableInfo] = agentState.variableInfoList;

      // set the minNumElements to be 1
      variableInfo.minNumElements = 1;

      // make sure lowerThresholdPercent is defined for this test
      variableInfo.lowerThresholdPercent = newThresholdLimit;
      /* eslint-enable no-param-reassign */

      // add new mocked functions to the mockContract corresponding to the variable names for getter
      // functions found in the config file
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(initialGetterValue);

      // run the agent once
      await handleBlock(agentState);

      // update the value returned by the target getter function to be greater than the
      // lowerThresholdPercent change
      const newValue = initialGetterValue - 1;
      mockContract[functionInConfig.name] = jest.fn().mockResolvedValue(newValue);

      // run the agent again now that we have seen the minimum number of data points
      const findings = await handleBlock(agentState);
      expect(findings).toStrictEqual([]);
    });
  });
});
