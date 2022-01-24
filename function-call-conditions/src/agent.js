// tx: 0x27ba3d7e95672ac2086469c827782caef0f3b72837e78951eabbe069eceecdb8
const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const BigNumber = require('bignumber.js');

const config = require('../agent-config.json');

const { getAbi, extractFunctionArgs } = require('./common');

function isNumeric(valueString) {
  // Verify that the string only contains numeric characters 0-9
  const result = valueString.match(/[0-9]+/);
  return (result[0].length === result.input.length);
}

function isHexString(valueString) {
  // Verify that the characters after the '0x' are contained in 0-9 and a-f
  const result = valueString.toLowerCase().slice(2).match(/[0-9a-f]+/);
  return (result[0].length === result.input.length);
}

function parseExpression(expression) {
  const parts = expression.split(' ');

  // Only support variable, operator, comparisonValue
  if (parts.length !== 3) {
    throw new Error('Expression must contain three terms: variable operator value');
  }

  const { variableName, operator, value } = parts;

  // Address
  if (value.toLowerCase().startsWith('0x')) {
    // Check the first two characters for addresses
    // Check that the address has the appropriate number of characters
    if ((value.length !== 42) || (!isHexString(value))) {
      throw new Error('Address does not have the correct number of characters');
    }
    return { variableName, operator, value };
  }
  // Boolean
  else if ((value.toLowerCase() === 'true') || (value.toLowerCase() === 'false')) {
    return { variableName, operator, value };
  }
  // Number
  else if (isNumeric(value)) {
    const result = BigNumber(value);
    return { variableName, operator, value: result };
  }
  // Unhandled
  else {
    throw new Error(`Unsupported string specifying value: ${value}`);
  }
}

// set up a variable to hold initialization data used in the handler
const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {

    data.contractInfo = config.contracts;

    const contractNames = Object.keys(data.contractInfo);

    data.contracts = contractNames.map((name) => {
      const { address, abiFile, functions = {} } = data.contractInfo[name];
      const abi = getAbi(abiFile);
      const iface = new ethers.utils.Interface(abi);
      const functionNames = Object.keys(functions);

      let functionSignatures = functionNames.map((functionName) => {
        const { expression } = functions[functionName];

        try {
          const fragment = iface.getFunction(functionName);
          return fragment.format(ethers.utils.FormatTypes.full);
        } catch {
          return '';
        }
      });

      functionSignatures = functionSignatures.filter((signature) => signature !== '');

      const contract = {
        name,
        address,
        functions,
        functionSignatures,
      };

      return contract;
    });
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const { contracts } = data;

    const findings = [];

    contracts.forEach((contract) => {
      const { name, address, functions, functionSignatures } = contract;

      console.log(functionSignatures);

      const parsedFunctions = txEvent.filterFunction(functionSignatures, address);

      console.log(parsedFunctions);
    });

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
