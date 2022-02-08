const BigNumber = require('bignumber.js');
const RollingMath = require('rolling-math');

function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
}

// get a list of variable getter information objects for each variable name listed for a given
// contract in the config
function getVariableInfo(contractConfig, currentContract) {
  const { variables } = contractConfig;
  const info = [];

  const variableNames = Object.keys(variables);

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
  }

  return percentOver;
}

module.exports = {
  getAbi,
  getVariableInfo,
  checkThreshold,
};
