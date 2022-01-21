/* Library of common functions */

function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
}

// helper function that identifies key strings in the args array obtained from transaction parsing
// these key-value pairs will be added to the metadata as function args
// all values are converted to strings so that BigNumbers are readable
function extractFunctionArgs(args) {
  const functionArgs = {};
  Object.keys(args).forEach((key) => {
    if (Number.isNaN(Number(key))) {
      functionArgs[key] = args[key].toString();
    }
  });
  return functionArgs;
}

module.exports = {
  getAbi,
  extractFunctionArgs,
};
