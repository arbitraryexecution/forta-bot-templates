const { Finding, ethers } = require('forta-agent');
const { getInternalAbi, createProposalFromLog } = require('../utils');

// alert for when a new governance proposal is created
function proposalCreatedFinding(proposal, address, config) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Created`,
    description: `Governance Proposal ${proposal.proposalId} was just created`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-PROPOSAL-CREATED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      ...proposal,
    },
  });
}

function voteCastFinding(voteInfo, address, config) {
  let description = `Vote cast with weight ${voteInfo.weight.toString()}`;
  switch (voteInfo.support) {
    case 0:
      description += ' against';
      break;
    case 1:
      description += ' in support of';
      break;
    case 2:
      description += ' abstaining from';
      break;
    default:
      description += ` with unknown support "${voteInfo.support}" for`;
  }
  description += ` proposal ${voteInfo.proposalId}`;

  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Vote Cast`,
    description,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-VOTE-CAST`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      voter: voteInfo.voter,
      weight: voteInfo.weight.toString(),
      reason: voteInfo.reason,
    },
  });
}

function proposalCanceledFinding(proposalId, address, config) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Canceled`,
    description: `Governance proposal ${proposalId} has been canceled`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CANCELED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      proposalId,
      state: 'canceled',
    },
  });
}

function proposalExecutedFinding(proposalId, address, config) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Executed`,
    description: `Governance proposal ${proposalId} has been executed`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-EXECUTED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      proposalId,
      state: 'executed',
    },
  });
}

function proposalQueuedFinding(proposalId, address, config, eta) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Queued`,
    description: `Governance Proposal ${proposalId} has been queued`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-QUEUED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      eta,
      proposalId,
      state: 'queued',
    },
  });
}

function quorumNumeratorUpdatedFinding(address, config, oldNum, newNum) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Quorum Numerator Updated`,
    description: `Quorum numerator updated from ${oldNum} to ${newNum}`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-QUORUM-NUMERATOR-UPDATED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      oldNumerator: oldNum,
      newNumerator: newNum,
    },
  });
}

function timelockChangeFinding(address, config, oldAddress, newAddress) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Timelock Address Change`,
    description: `Timelock address changed from ${oldAddress} to ${newAddress}`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-TIMELOCK-ADDRESS-CHANGED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      oldTimelockAddress: oldAddress,
      newTimelockAddress: newAddress,
    },
  });
}

function votingDelaySetFinding(address, config, oldDelay, newDelay) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Voting Delay Set`,
    description: `Voting delay change from ${oldDelay} to ${newDelay}`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-VOTING-DELAY-SET`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      oldVotingDelay: oldDelay,
      newVotingDelay: newDelay,
    },
  });
}

function votingPeriodSetFinding(address, config, oldPeriod, newPeriod) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Voting Period Set`,
    description: `Voting period change from ${oldPeriod} to ${newPeriod}`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-VOTING-PERIOD-SET`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      oldVotingPeriod: oldPeriod,
      newVotingPeriod: newPeriod,
    },
  });
}

function proposalThresholdSetFinding(address, config, oldThresh, newThresh) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Threshold Set`,
    description: `Proposal threshold change from ${oldThresh} to ${newThresh}`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-THRESHOLD-SET`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      oldThreshold: oldThresh,
      newThreshold: newThresh,
    },
  });
}

const initialize = async (config) => {
	let agentState = {};

	agentState.config = {
		developerAbbreviation: config.developerAbbreviation,
		protocolName: config.protocolName,
		protocolAbbreviation: config.protocolAbbreviation,
	};
	agentState.goverance = config.contracts;
	agentState.contracts = Object.entries(agentState.goverance).map(([name, entry]) => {
		const { governance: { abiFile }, address } = entry;

		if (address === undefined) {
			throw new Error(`No address found in configuration file for '${name}'`);
		}

		if (abiFile === undefined) {
			throw new Error(`No ABI file found in configuration file for '${name}'`);
		}

		const abi = getInternalAbi(config.agentType, abiFile);
		const iface = new ethers.utils.Interface(abi);
		const names = Object.keys(iface.events);
		const ftype = ethers.utils.FormatTypes.full;
		const eventSignatures = names.map((eventName) => iface.getEvent(eventName).format(ftype));

		const contract = {
			address,
			eventSignatures,
		};
		return contract;
	});

	return agentState;
};

const handleTransaction = async (agentState, txEvent) => {
	const findings = [];

	agentState.contracts.forEach((contract) => {
		const { address, eventSignatures } = contract;
		const logs = txEvent.filterLog(eventSignatures, address);

		// iterate over all logs to determine what governance actions were taken
		let results = logs.map((log) => {
			switch (log.name) {
				case 'ProposalCreated':
					const proposal = createProposalFromLog(log);
					return proposalCreatedFinding(
						proposal,
						address,
						agentState.config,
					);
				case 'VoteCast':
					const voteInfo = {
						voter: log.args.voter,
						proposalId: log.args.proposalId.toString(),
						support: log.args.support,
						weight: log.args.weight,
						reason: log.args.reason,
					};
					return voteCastFinding(voteInfo, address, agentState.config);
				case 'ProposalCanceled':
					return proposalCanceledFinding(log.args.proposalId.toString(), address, agentState.config);
				case 'ProposalExecuted':
					return proposalExecutedFinding(log.args.proposalId.toString(), address, agentState.config);
				case 'QuorumNumeratorUpdated':
					return quorumNumeratorUpdatedFinding(
						address,
						agentState.config,
						log.args.oldQuorumNumerator.toString(),
						log.args.newQuorumNumerator.toString(),
					);
				case 'ProposalQueued':
					return proposalQueuedFinding(
						log.args.proposalId.toString(),
						address,
						agentState.config,
						log.args.eta.toString(),
					);
				case 'TimelockChange':
					return timelockChangeFinding(
						address,
						agentState.config,
						log.args.oldTimelock,
						log.args.newTimelock,
					);
				case 'VotingDelaySet':
					return votingDelaySetFinding(
						address,
						agentState.config,
						log.args.oldVotingDelay.toString(),
						log.args.newVotingDelay.toString(),
					);
				case 'VotingPeriodSet':
					return votingPeriodSetFinding(
						address,
						agentState.config,
						log.args.oldVotingDelay.toString(),
						log.args.newVotingDelay.toString(),
					);
				case 'ProposalThresholdSet':
					return proposalThresholdSetFinding(
						address,
						agentState.config,
						log.args.oldProposalThreshold.toString(),
						log.args.newProposalThreshold.toString(),
					);
				default:
					return undefined;
			}
		});

		results = results.filter((result) => result !== undefined);
		findings.push(...(results.flat()));
	});

	return findings;
};

module.exports = {
	initialize,
	handleTransaction,
};
