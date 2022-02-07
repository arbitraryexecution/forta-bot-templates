function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
}

function createProposalFromLog(log) {
  const proposalId = log.args.proposalId.toString();
  const proposal = {
    proposalId,
    proposer: log.args.proposer,
    targets: log.args.targets.join(','),
    // the 'values' key has to be parsed differently because `values` is a named method on Objects
    // in JavaScript.  Also, this is why the key is prefixed with an underscore, to avoid
    // overwriting the `values` method.
    _values: (log.args[3].map((v) => v.toString())).join(','),
    signatures: log.args.signatures.join(','),
    calldatas: log.args.calldatas.join(','),
    startBlock: log.args.startBlock.toString(),
    endBlock: log.args.endBlock.toString(),
    description: log.args.description,
  };
  return proposal;
}

module.exports = {
  getAbi,
  getProposalCreatedEvent,
};
