const BigNumber = require('bignumber.js');
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');
const RollingMath = require('rolling-math');

const { getAbi } = require('./utils');

// load any agent configuration parameters
const config = require('../agent-config-test.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// get a list of variable getter information objects for each variable name listed for a given
// contract in the config
function getVariableInfo(contractConfig, variableList) {
  // TODO: check to make sure this works correctly for proxy contracts -> doesn't look like it
  // will get the right ethers contract (since we don't pass in a list of contracts to add?)
  const proxyName = contractConfig.proxy;
  const { variables } = contractConfig;
  const info = [];

  let variableNames = [];
  if (variableList === undefined) {
    if (proxyName === undefined) {
      return {}; // no variables for this contract are specified in the config
    }
  } else {
    variableNames = Object.keys(variables);
  }

  if (proxyName) {
    // contract is a proxy, look up public getters for the requested variables (if any) for the
    // contract the proxy is pointing to
    const proxyVariables = variableList[proxyName].variables;
    if (proxyVariables) {
      if (variableList === undefined) {
        // eslint-disable-next-line no-param-reassign
        variableList = { ...proxyVariables };
      } else {
        // eslint-disable-next-line no-param-reassign
        variableList = { ...variableList, ...proxyVariables };
      }
    }

    Object.keys(proxyVariables).forEach((variableName) => {
      const variableInfo = proxyVariables[variableName];

      // make sure either upper threshold percent or lower threshold percent for a given variable
      // is defined in the config
      if (variableInfo.upperThresholdPercent === undefined
        && variableInfo.lowerThresholdPercent === undefined) {
        throw new Error('Either the Upper Threshold Percent or Lower Threshold Percent for the'
            + ` variable ${variableName} must be defined`);
      }

      const getterObject = {
        name: variableName,
        type: proxyVariables[variableName].type,
        severity: proxyVariables[variableName].severity,
      };

      if (variableInfo.upperThresholdPercent !== undefined) {
        getterObject.upperThresholdPercent = variableInfo.upperThresholdPercent;
      }
      if (variableInfo.lowerThresholdPercent !== undefined) {
        getterObject.lowerThresholdPercent = variableInfo.lowerThresholdPercent;
      }

      // create the rolling math array, if numDataPoints is present in the config use its
      // corresponding value for array size, otherwise set the array size to 1
      const arraySize = variableInfo.numDataPoints ? variableInfo.numDataPoints : 1;
      getterObject.pastValues = new RollingMath(arraySize);
      getterObject.minNumElements = arraySize;

      info.push(getterObject);
    });
  }

  variableNames.forEach((variableName) => {
    const variableInfo = variables[variableName];

    // make sure either upper threshold percent or lower threshold percent for a given variable
    // is defined in the config
    if (variableInfo.upperThresholdPercent === undefined
      && variableInfo.lowerThresholdPercent === undefined) {
      throw new Error('Either the upperThresholdPercent or lowerThresholdPercent for the'
        + ` variable ${variableName} must be defined`);
    }

    const getterObject = {
      name: variableName,
      type: variables[variableName].type,
      severity: variables[variableName].severity,
    };

    if (variableInfo.upperThresholdPercent !== undefined) {
      getterObject.upperThresholdPercent = variableInfo.upperThresholdPercent;
    }
    if (variableInfo.lowerThresholdPercent !== undefined) {
      getterObject.lowerThresholdPercent = variableInfo.lowerThresholdPercent;
    }

    // create the rolling math array, if numDataPoints is present in the config use its
    // corresponding value for array size, otherwise set the array size to 1
    const arraySize = variableInfo.numDataPoints ? variableInfo.numDataPoints : 1;
    getterObject.pastValues = new RollingMath(arraySize);
    getterObject.minNumElements = arraySize;

    info.push(getterObject);
  });

  return { info };
}

// helper function to create alerts
function createAlert(
  variableName,
  contractName,
  contractAddress,
  type,
  severity,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  thresholdPosition,
  thresholdPercentLimit,
  actualPercent,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Contract Variable`,
    description: `The ${variableName} variable value in the ${contractName} contract had a change`
      + ` in value over the ${thresholdPosition} threshold limit of ${thresholdPercentLimit}`
      + ' percent',
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-CONTRACT-VARIABLE`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      variableName,
      thresholdPosition,
      thresholdPercentLimit,
      actualPercent,
    },
  });

  return Finding.fromObject(finding);
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.provider = getEthersProvider();
    data.configEntries = config.contracts;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    // load the contract addresses, abis, and ethers interfaces
    data.contracts = Object.entries(data.configEntries).map(([name, entry]) => {
      if (entry.address === undefined) {
        throw new Error(`No address found in configuration file for '${name}'`);
      }

      if (entry.abiFile === undefined) {
        throw new Error(`No ABI file found in configuration file for '${name}'`);
      }

      const abi = getAbi(entry.abiFile);

      const contractInfo = {
        name,
        address: entry.address,
        contract: new ethers.Contract(entry.address, abi, data.provider),
      };

      return contractInfo;
    });

    data.contracts.forEach((contractInfo) => {
      const entry = data.configEntries[contractInfo.name];
      const { info } = getVariableInfo(entry, data.configEntries);
      contractInfo.variableInfoList = info;
    });

    /* eslint-enable no-param-reassign */
  };
}

function checkThreshold(thresholdPercent, currValue, pastValues) {
  const thresholdPercentBN = new BigNumber(thresholdPercent);
  const averageBN = pastValues.getAverage();
  const differenceBN = currValue.minus(averageBN).abs();
  const differencePercentBN = differenceBN.div(averageBN).times(100);
  let percentOver;

  if (differencePercentBN.gt(thresholdPercentBN)) {
    percentOver = differencePercentBN;
    return percentOver;
  }

  return percentOver;
}

function provideHandleBlock(data) {
  return async function handleBlock() {
    const {
      contracts, protocolName, protocolAbbreviation, developerAbbreviation,
    } = data;

    // iterate over each object containing contract info in contracts
    const contractPromises = contracts.map(async (contractInfo) => {
      const {
        name: contractName, address, contract, variableInfoList,
      } = contractInfo;

      // for each item present in variableInfo, attempt to invoke the getter method corresponding
      // to the item's name and make sure it is within the specified threshold percent(s)
      const variablePromises = variableInfoList.map(async (variableInfo) => {
        const variableFindings = [];
        const {
          name: variableName,
          type,
          severity,
          upperThresholdPercent,
          lowerThresholdPercent,
          minNumElements,
          pastValues,
        } = variableInfo;

        // attempt to invoke the getter method for the specified variable name
        let newValue = await contract[variableName]();
        newValue = new BigNumber(newValue.toString());

        // check the current number of elements in the pastValues array
        if (pastValues.getNumElements() >= minNumElements) {
          if (upperThresholdPercent !== undefined) {
            const percentOver = checkThreshold(upperThresholdPercent, newValue, pastValues);
            if (percentOver !== undefined) {
              variableFindings.push(createAlert(
                variableName,
                contractName,
                address,
                type,
                severity,
                protocolName,
                protocolAbbreviation,
                developerAbbreviation,
                'upper',
                upperThresholdPercent,
                percentOver.toString(),
              ));
            }
          }

          if (lowerThresholdPercent !== undefined) {
            const percentOver = checkThreshold(lowerThresholdPercent, newValue, pastValues);
            if (percentOver !== undefined) {
              variableFindings.push(createAlert(
                variableName,
                contractName,
                address,
                type,
                severity,
                protocolName,
                protocolAbbreviation,
                developerAbbreviation,
                'lower',
                lowerThresholdPercent,
                percentOver.toString(),
              ));
            }
          }
        }

        // add the value received in this iteration to the pastValues array
        pastValues.addElement(newValue);
        return variableFindings;
      });

      return (await Promise.all(variablePromises)).flat();
    });

    const findings = (await Promise.all(contractPromises)).flat();
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  createAlert,
};
