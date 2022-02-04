function getObjectsFromAbi(abi, objectType) {
  const contractObjects = {};
  abi.forEach((entry) => {
    if (entry.type === objectType) {
      contractObjects[entry.name] = entry;
    }
  });
  return contractObjects;
}

function getFunctionFromConfig(abi, functions, fakeFunctionName) {
  let functionInConfig;
  let functionNotInConfig;
  let findingType;
  let findingSeverity;

  const functionsInConfig = Object.keys(functions);
  const functionObjects = getObjectsFromAbi(abi, 'function');
  Object.keys(functionObjects).forEach((name) => {
    if ((functionsInConfig.indexOf(name) !== -1) && (functionInConfig === undefined)) {
      functionInConfig = functionObjects[name];
      findingType = functions[name].type;
      findingSeverity = functions[name].severity;
    }
    if (name === fakeFunctionName) {
      functionNotInConfig = functionObjects[name];
    }
  });
  return {
    functionInConfig, functionNotInConfig, findingType, findingSeverity,
  };
}

// create a fake function name
function getRandomCharacterString(numCharacters) {
  let result = '';
  let charCode;
  for (let i = 0; i < numCharacters; i += 1) {
    charCode = Math.floor(Math.random() * 52);
    if (charCode < 26) {
      charCode += 65;
    } else {
      charCode += 97 - 26;
    }
    result += String.fromCharCode(charCode);
  }
  return result;
}

module.exports = {
  getObjectsFromAbi,
  getFunctionFromConfig,
  getRandomCharacterString,
};
