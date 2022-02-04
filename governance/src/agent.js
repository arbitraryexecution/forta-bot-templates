// VoteCast Tx: 0x4f8f3d7827467229caffb8570a9b38aa78448ca358863d7ad17ea4a75673745d
// ProposalCreated Tx: 0x46fb3ad1837ca8fbbd88e6654424752faa20430fab0517c2d965b26759292d4b
// ProposalExecuted Tx: 0xd1924e6d2b04303262fe90d6a354f92d795a6ce4bd7908cd77869aae50e77f43
// ProposalQueued Tx: 0x1a9692a039baebcedc28b13447e3528a6a469b8ae9e8241df14f50a5cbad25dd
// ProposalCanceled Tx: 0xc09ea70ee0f2e05eff9ff63b09195a6714681c18a145c019de8e5fbc9e01e675
const { Finding, ethers } = require('forta-agent');

const agentConfig = require('../agent-config.json');

const { getAbi, createProposalFromLog } = require('./utils');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

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

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    data.config = {
      developerAbbreviation: agentConfig.developerAbbreviation,
      protocolName: agentConfig.protocolName,
      protocolAbbreviation: agentConfig.protocolAbbreviation,
    };
    data.address = agentConfig.governance.address;

    const { abiFile } = agentConfig.governance;
    data.abi = getAbi(abiFile);

    data.iface = new ethers.utils.Interface(data.abi);

    const names = Object.keys(data.iface.events);
    const ftype = ethers.utils.FormatTypes.full;
    data.eventSignatures = names.map((name) => data.iface.getEvent(name).format(ftype));
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      config,
      address,
      eventSignatures,
    } = data;

    const findings = [];

    const logs = txEvent.filterLog(eventSignatures, address);

    // iterate over all logs to determine what governance actions were taken
    let results = logs.map((log) => {
      let proposal;
      let voteInfo;
      switch (log.name) {
        case 'ProposalCreated':
          // create a finding for a new proposal
          proposal = createProposalFromLog(log);
          return proposalCreatedFinding(
            proposal,
            address,
            config,
          );
        case 'VoteCast':
          // add the vote to the corresponding proposal object
          voteInfo = {
            voter: log.args.voter,
            proposalId: log.args.proposalId.toString(),
            support: log.args.support,
            weight: log.args.weight,
            reason: log.args.reason,
          };
          // create a finding indicating that the vote was cast
          return voteCastFinding(voteInfo, address, config);
        case 'ProposalCanceled':
          // create a finding indicating that the proposal has been canceled,
          return proposalCanceledFinding(log.args.proposalId.toString(), address, config);
        case 'ProposalExecuted':
          // create a finding indicating that the proposal has been executed,
          return proposalExecutedFinding(log.args.proposalId.toString(), address, config);
        case 'QuorumNumeratorUpdated':
          return quorumNumeratorUpdatedFinding(
            address,
            config,
            log.args.oldQuorumNumerator.toString(),
            log.args.newQuorumNumerator.toString(),
          );
        case 'ProposalQueued':
          return proposalQueuedFinding(
            log.args.proposalId.toString(),
            address,
            config,
            log.args.eta.toString(),
          );
        case 'TimelockChange':
          return timelockChangeFinding(address, config, log.args.oldTimelock, log.args.newTimelock);
        case 'VotingDelaySet':
          return votingDelaySetFinding(
            address,
            config,
            log.args.oldVotingDelay.toString(),
            log.args.newVotingDelay.toString(),
          );
        case 'VotingPeriodSet':
          return votingPeriodSetFinding(
            address,
            config,
            log.args.oldVotingDelay.toString(),
            log.args.newVotingDelay.toString(),
          );
        case 'ProposalThresholdSet':
          return proposalThresholdSetFinding(
            address,
            config,
            log.args.oldProposalThreshold.toString(),
            log.args.newProposalThreshold.toString(),
          );
        default:
          return [];
      }
    });

    results = results.filter((result) => result !== []);

    findings.push(...(results.flat()));

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
