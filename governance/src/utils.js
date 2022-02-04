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
    _values: (log.args[3].map((v) => v.toString())).join(','),
    signatures: log.args.signatures.join(','),
    calldatas: log.args.calldatas.join(','),
    startBlock: log.args.startBlock.toString(),
    endBlock: log.args.endBlock.toString(),
    description: log.args.description,
  };
  return proposal;
}

async function getProposalCreatedEvent(contract, proposalId, currentBlock) {
  const votingPeriod = (await contract.votingPeriod()).toNumber();
  const votingDelay = (await contract.votingDelay()).toNumber();

  const topics = contract.interface.encodeFilterTopics('ProposalCreated', []);
  const filter = {
    address: contract.address.toLowerCase(),
    topics,
    fromBlock: currentBlock - votingPeriod - votingDelay,
    toBlock: currentBlock - votingDelay,
  };
  const rawLogs = await contract.provider.getLogs(filter);

  let result = rawLogs.map((rawLog) => {
    const log = contract.interface.parseLog({ data: rawLog.data, topics: rawLog.topics });
    if (proposalId === log.args.proposalId.toString()) {
      return createProposalFromLog(log);
    }
    return undefined;
  });

  result = result.filter((entry) => entry !== undefined);
  if (result.length !== 1) {
    throw new Error('Unable to find single match for event when proposal was created');
  }
  return result[0];
}

module.exports = {
  getAbi,
  createProposalFromLog,
  getProposalCreatedEvent,
};
