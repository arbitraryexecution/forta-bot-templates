const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const {
  parseExpression,
  checkLogAgainstExpression,
  getAbi,
  extractFunctionArgs,
  isFilledString,
  isAddress,
  isObject,
  isEmptyObject
} = require('../utils');
const { getObjectsFromAbi } = require("../test-utils");

// helper function to create alerts
function createAlert(
  functionName,
  contractName,
  contractAddress,
  functionType,
  functionSeverity,
  args,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  expression,
) {
  const functionArgs = extractFunctionArgs(args);

  const finding = {
    name: `${protocolName} Function Call`,
    description: `The ${functionName} function was invoked in the ${contractName} contract`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-FUNCTION-CALL`,
    type: FindingType[functionType],
    severity: FindingSeverity[functionSeverity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      functionName,
      ...functionArgs,
    },
  };

  if (expression !== undefined) {
    finding.description += `, condition met: ${expression}`;
  }

  return Finding.fromObject(finding);
}

const validateConfig = (config, abiOverride = null) => {
  let ok = false;
  let errMsg = "";

  if (!isFilledString(config.developerAbbreviation)) {
      errMsg = `developerAbbreviation required`;
      return { ok, errMsg };
  }
  if (!isFilledString(config.protocolName)) {
      errMsg = `protocolName required`;
      return { ok, errMsg };
  }
  if (!isFilledString(config.protocolAbbreviation)) {
      errMsg = `protocolAbbreviation required`;
      return { ok, errMsg };
  }

  const { contracts } = config;
  if (!isObject(contracts) || isEmptyObject(contracts)) {
    errMsg = `contracts key required`;
    return { ok, errMsg };
  }

  for (const entry of Object.values(contracts)) {
    const { address, abiFile, functions } = entry;

    // check that the address is a valid address
    if (!isAddress(address)) {
      errMsg = `invalid address`;
      return { ok, errMsg };
    }

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    let abi;
    if (abiOverride != null) {
      abi = abiOverride[abiFile];
    } else {
      abi = getAbi(config.name, abiFile);
    }

    // get all of the function objects from the loaded ABI file
    const functionObjects = getObjectsFromAbi(abi, 'function');

    // for all of the functions specified, verify that they exist in the ABI
    for (const functionName of Object.keys(functions)) {

      if (Object.keys(functionObjects).indexOf(functionName) == -1) {
        errMsg = `invalid function`;
        return { ok, errMsg };
      }

      // extract the keys from the configuration file for a specific function
      const { expression, type, severity } = functions[functionName];

      // the expression key can be left out, but if it's present, verify the expression
      if (expression !== undefined) {
        // if the expression is not valid, the call to parseExpression will fail
        const expressionObject = parseExpression(expression);

        // check the function definition to verify the argument name
        const { inputs } = functionObjects[functionName];
        const argumentNames = inputs.map((inputEntry) => inputEntry.name);

        // verify that the argument name is present in the function Object
        if (argumentNames.indexOf(expressionObject.variableName) == -1) {
          errMsg = `invalid argument`;
          return { ok, errMsg };
        }
      }

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
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config, abiOverride = null) => {
  let botState = {...config};

  const { ok, errMsg } = validateConfig(config, abiOverride);
  if (!ok) {
    throw new Error(errMsg);
  }

  botState.contracts = Object.keys(config.contracts).map((name) => {
    const { address, abiFile, functions } = config.contracts[name];
    let abi;
    if (abiOverride != null) {
      abi = abiOverride[abiFile];
    } else {
      abi = getAbi(config.name, abiFile);
    }

    const iface = new ethers.utils.Interface(abi);
    const functionNames = Object.keys(functions);

    const functionSignatures = functionNames.map((functionName) => {
      const { expression, type, severity } = functions[functionName];
      const fragment = iface.getFunction(functionName);

      const result = {
        functionName,
        signature: fragment.format(ethers.utils.FormatTypes.full),
        functionType: type,
        functionSeverity: severity,
      };

      if (expression !== undefined) {
        result.expression = expression;
        result.expressionObject = parseExpression(expression);
      }

      return result;
    });

    const contract = {
      name,
      address,
      functions,
      functionSignatures,
    };
    return contract;
  });

  return botState;
};

const handleTransaction = async (botState, txEvent) => {
  const findings = [];

  botState.contracts.forEach((contract) => {
    const {
      name,
      address,
      functionSignatures,
    } = contract;

    functionSignatures.forEach((entry) => {
      const {
        functionName,
        signature,
        expressionObject,
        expression,
        functionType,
        functionSeverity,
      } = entry;

      // filterFunction accepts either a string or an Array of strings
      // here we will only pass in one string at a time to keep the synchronization with
      // the expressions that we need to evaluate
      const parsedFunctions = txEvent.filterFunction(signature, address);

      // loop over the Array of results
      // the transaction may contain more than one function call to the same function
      parsedFunctions.forEach((parsedFunction) => {
        // if there is an expression to check, verify the condition before creating an alert
        if (expression !== undefined) {
          if (!checkLogAgainstExpression(expressionObject, parsedFunction)) {
            return;
          }
        }

        // create a finding
        findings.push(createAlert(
          functionName,
          name,
          address,
          functionType,
          functionSeverity,
          parsedFunction.args,
          botState.protocolName,
          botState.protocolAbbreviation,
          botState.developerAbbreviation,
          expression,
        ));
      });
    });
  });

  return findings;
};

module.exports = {
  validateConfig,
  initialize,
  handleTransaction,
};
