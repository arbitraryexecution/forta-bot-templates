const BigNumber = require('bignumber.js');
const RollingMath = require('rolling-math');

function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
}

// get a list of variable getter information objects for each variable name listed for a given
// contract in the config
function getVariableInfo(contractConfig, currentContract, variableList, contractList) {
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

      // find the contract the proxy is pointing to and add the contract with the other variable
      // info
      const [proxiedContract] = contractList.filter((contract) => proxyName === contract.name);
      const getterObject = {
        name: variableName,
        type: proxyVariables[variableName].type,
        severity: proxyVariables[variableName].severity,
        contractInfo: proxiedContract,
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
      contractInfo: currentContract,
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

module.exports = {
  getAbi,
  getVariableInfo,
  checkThreshold,
};
