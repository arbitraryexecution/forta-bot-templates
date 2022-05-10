const BigNumber = require('bignumber.js');
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

const utils = require('../utils');
const {
  getObjectsFromAbi,
} = require('../test-utils');

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
  actualPercentChange,
) {
  return Finding.fromObject({
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
      thresholdPercentLimit: thresholdPercentLimit.toString(),
      actualPercentChange,
    },
  });
}

const validateConfig = (config, abiOverride = null) => {
  let ok = false;
  let errMsg = "";

  if (!utils.isFilledString(config.developerAbbreviation)) {
      errMsg = `developerAbbreviation required`;
      return { ok, errMsg };
  }
  if (!utils.isFilledString(config.protocolName)) {
      errMsg = `protocolName required`;
      return { ok, errMsg };
  }
  if (!utils.isFilledString(config.protocolAbbreviation)) {
      errMsg = `protocolAbbreviation required`;
      return { ok, errMsg };
  }

  const { contracts } = config;
  if (!utils.isObject(contracts) || utils.isEmptyObject(contracts)) {
    errMsg = `contracts key required`;
    return { ok, errMsg };
  }

  for (const entry of Object.values(contracts)) {
    const { address, abiFile, variables } = entry;

    // check that the address is a valid address
    if (!utils.isAddress(address)) {
      errMsg = `invalid address`;
      return { ok, errMsg };
    }

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    let abi;
    if (abiOverride != null) {
      abi = abiOverride[abiFile];
    } else {
      abi = utils.getAbi(config.name, abiFile);
    }

    // get all of the function objects from the loaded ABI file
    const functionObjects = getObjectsFromAbi(abi, 'function');

    // for all of the variable names specified, verify that their corresponding getter function
    // exists in the ABI
    for (const variableName of Object.keys(variables)) {
      if (Object.keys(functionObjects).indexOf(variableName) == -1) {
        errMsg = `invalid event`;
        return { ok, errMsg };
      }

      // assert that the output array length for the getter function is one
      if (functionObjects[variableName].outputs.length != 1) {
        errMsg = `invalid variable`;
        return { ok, errMsg };
      }

      // assert that the type of the output for the getter function is a (u)int type
      if (functionObjects[variableName].outputs[0].type.match(/^u?int/) == null) {
        errMsg = `invalid getter function type`;
        return { ok, errMsg };
      }

      // extract the keys from the configuration file for a specific function
      const {
        type,
        severity,
        upperThresholdPercent,
        lowerThresholdPercent,
        numDataPoints,
      } = variables[variableName];

      // check type, this will fail if 'type' is not valid
      if (!Object.prototype.hasOwnProperty.call(FindingType, type)) {
        errMsg = `invalid finding type!`;
        return { ok, errMsg };
      }

      // check severity, this will fail if 'severity' is not valid
      if (!Object.prototype.hasOwnProperty.call(FindingSeverity, severity)) {
        errMsg = `invalid finding severity!`;
        return { ok, errMsg };
      }

      // make sure there is at least one threshold value present in the config, otherwise fail
      if (upperThresholdPercent === undefined && lowerThresholdPercent === undefined) {
        errMsg = ('Either the upperThresholdPercent or lowerThresholdPercent for the'
          + ` variable ${variableName} must be defined`);
        return { ok, errMsg };
      }

      // if upperThresholdPercent is defined, make sure the value is a number
      if (upperThresholdPercent !== undefined && typeof upperThresholdPercent != 'number') {
        errMsg = `invalid upperThresholdPercent`;
        return { ok, errMsg };
      }

      // if lowerThresholdPercent is defined, make sure the value is a number
      if (lowerThresholdPercent !== undefined && typeof lowerThresholdPercent != 'number') {
        errMsg = `invalid lowerThresholdPercent`;
        return { ok, errMsg };
      }

      // make sure value for numDataPoints in config is a number
      if (typeof numDataPoints != 'number') {
        errMsg = `invalid numDataPoints`;
        return { ok, errMsg };
      }
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config, abiOverride = null) => {
  let agentState = {...config};

  const { ok, errMsg } = validateConfig(config, abiOverride);
  if (!ok) {
    throw new Error(errMsg);
  }

  agentState.variableInfoList = [];

  const provider = getEthersProvider();

  // load the contract addresses, abis, and generate an ethers contract for each contract name
  // listed in the config
  const contractList = Object.entries(config.contracts).map(([name, entry]) => {
    let abi;
    if (abiOverride != null) {
      abi = abiOverride[entry.abiFile];
    } else {
      abi = utils.getAbi(config.name, entry.abiFile);
    }

    const contract = new ethers.Contract(entry.address, abi, provider);
    return { name, contract, };
  });

  contractList.forEach((contractEntry) => {
    const entry = config.contracts[contractEntry.name];
    const { info } = utils.getVariableInfo(entry, contractEntry);
    agentState.variableInfoList.push(...info);
  });

  return agentState;
};

const handleBlock = async (agentState, blockEvent) => {
  // for each item present in variableInfoList, attempt to invoke the getter method
  // corresponding to the item's name and make sure it is within the specified threshold percent
  const variablePromises = agentState.variableInfoList.map(async (variableInfo) => {
    const variableFindings = [];
    const {
      name: variableName,
      type,
      severity,
      contractInfo,
      upperThresholdPercent,
      lowerThresholdPercent,
      minNumElements,
      pastValues,
    } = variableInfo;
    const { name: contractName, contract } = contractInfo;

    let newValue = await contract[variableName]();
    newValue = new BigNumber(newValue.toString());
    const averageBN = pastValues.getAverage();

    // check the current number of elements in the pastValues array
    if (pastValues.getNumElements() >= minNumElements) {
      // only check for an upperThresholdPercent change if upperThresholdPercent exists and the
      // new value is greater than the current average
      if (upperThresholdPercent !== undefined && newValue.gt(averageBN)) {
        const percentOver = utils.checkThreshold(upperThresholdPercent, newValue, pastValues);
        if (percentOver !== undefined) {
          variableFindings.push(createAlert(
            variableName,
            contractName,
            contract.address,
            type,
            severity,
            agentState.protocolName,
            agentState.protocolAbbreviation,
            agentState.developerAbbreviation,
            'upper',
            upperThresholdPercent,
            percentOver.toString(),
          ));
        }
      }

      // only check for a lowerThresholdPercent change if lowerThresholdPercent exists and the
      // new value is less than the current average
      if (lowerThresholdPercent !== undefined && newValue.lt(averageBN)) {
        const percentOver = utils.checkThreshold(lowerThresholdPercent, newValue, pastValues);
        if (percentOver !== undefined) {
          variableFindings.push(createAlert(
            variableName,
            contractName,
            contract.address,
            type,
            severity,
            agentState.protocolName,
            agentState.protocolAbbreviation,
            agentState.developerAbbreviation,
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

  const findings = (await Promise.all(variablePromises)).flat();
  return findings;
};

module.exports = {
  validateConfig,
  initialize,
  handleBlock,
  createAlert,
};
