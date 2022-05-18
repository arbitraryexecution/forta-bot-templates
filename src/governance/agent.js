const { Finding, ethers } = require('forta-agent');
const {
  getInternalAbi,
  createProposalFromLog,
  isObject,
  isEmptyObject,
  isFilledString,
  isAddress,
} = require('../utils');
const {
  getObjectsFromAbi,
} = require('../test-utils');

// alert for when a new governance proposal is created
function proposalCreatedFinding(proposal, address, config, addresses) {
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
    addresses,
  });
}

function voteCastFinding(voteInfo, address, config, addresses) {
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
    addresses,
  });
}

function proposalCanceledFinding(proposalId, address, config, addresses) {
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
    addresses,
  });
}

function proposalExecutedFinding(proposalId, address, config, addresses) {
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
    addresses,
  });
}

function proposalQueuedFinding(proposalId, address, config, eta, addresses) {
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
    addresses,
  });
}

function quorumNumeratorUpdatedFinding(address, config, oldNum, newNum, addresses) {
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
    addresses,
  });
}

function timelockChangeFinding(address, config, oldAddress, newAddress, addresses) {
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
    addresses,
  });
}

function votingDelaySetFinding(address, config, oldDelay, newDelay, addresses) {
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
    addresses,
  });
}

function votingPeriodSetFinding(address, config, oldPeriod, newPeriod, addresses) {
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
    addresses,
  });
}

function proposalThresholdSetFinding(address, config, oldThresh, newThresh, addresses) {
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
    addresses,
  });
}

const validateConfig = (config) => {
  let ok = false;
  let errMsg = '';

  const MINIMUM_EVENT_LIST = [
    'ProposalCreated',
    'VoteCast',
    'ProposalCanceled',
    'ProposalExecuted',
  ];

  if (!isFilledString(config.developerAbbreviation)) {
    errMsg = 'developerAbbreviation required';
    return { ok, errMsg };
  }
  if (!isFilledString(config.protocolName)) {
    errMsg = 'protocolName required';
    return { ok, errMsg };
  }
  if (!isFilledString(config.protocolAbbreviation)) {
    errMsg = 'protocolAbbreviation required';
    return { ok, errMsg };
  }

  let name;
  let entry;
  const entries = Object.entries(config.contracts);
  for (let j = 0; j < entries.length; j += 1) {
    [name, entry] = entries[j];
    if (!isObject(entry) || isEmptyObject(entry)) {
      errMsg = 'contract keys in contracts required';
      return { ok, errMsg };
    }

    const { governance: { abiFile, address } } = entry;

    if (address === undefined) {
      errMsg = `No address found in configuration file for '${name}'`;
      return { ok, errMsg };
    }

    if (abiFile === undefined) {
      errMsg = `No ABI file found in configuration file for '${name}'`;
      return { ok, errMsg };
    }

    // check that the address is a valid address
    if (!isAddress(address)) {
      errMsg = 'invalid address';
      return { ok, errMsg };
    }

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    const abi = getInternalAbi(config.botType, abiFile);

    // extract all of the event names from the ABI
    const events = getObjectsFromAbi(abi, 'event');

    // verify that at least the minimum list of supported events are present
    for (let i = 0; i < MINIMUM_EVENT_LIST.length; i += 1) {
      const eventName = MINIMUM_EVENT_LIST[i];
      if (Object.keys(events).indexOf(eventName) === -1) {
        errMsg = `ABI does not contain minimum supported event: ${eventName}`;
        return { ok, errMsg };
      }
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config) => {
  const botState = { ...config };

  const { ok, errMsg } = validateConfig(config);
  if (!ok) {
    throw new Error(errMsg);
  }

  botState.contracts = Object.entries(config.contracts).map(([, entry]) => {
    const { governance: { abiFile, address } } = entry;

    const abi = getInternalAbi(config.botType, abiFile);
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

  return botState;
};

const handleTransaction = async (botState, txEvent) => {
  const findings = [];

  botState.contracts.forEach((contract) => {
    const { address, eventSignatures } = contract;
    const logs = txEvent.filterLog(eventSignatures, address);

    let addresses = Object.keys(txEvent.addresses).map((addr) => addr.toLowerCase());
    addresses = addresses.filter((addr) => addr !== 'undefined');

    // iterate over all logs to determine what governance actions were taken
    let proposal;
    let voteInfo;
    let results = logs.map((log) => {
      switch (log.name) {
        case 'ProposalCreated':
          proposal = createProposalFromLog(log);
          return proposalCreatedFinding(
            proposal,
            address,
            botState,
            addresses,
          );
        case 'VoteCast':
          voteInfo = {
            voter: log.args.voter,
            proposalId: log.args.proposalId.toString(),
            support: log.args.support,
            weight: log.args.weight,
            reason: log.args.reason,
          };
          return voteCastFinding(voteInfo, address, botState, addresses);
        case 'ProposalCanceled':
          return proposalCanceledFinding(
            log.args.proposalId.toString(),
            address,
            botState,
            addresses,
          );
        case 'ProposalExecuted':
          return proposalExecutedFinding(
            log.args.proposalId.toString(),
            address,
            botState,
            addresses,
          );
        case 'QuorumNumeratorUpdated':
          return quorumNumeratorUpdatedFinding(
            address,
            botState,
            log.args.oldQuorumNumerator.toString(),
            log.args.newQuorumNumerator.toString(),
            addresses,
          );
        case 'ProposalQueued':
          return proposalQueuedFinding(
            log.args.proposalId.toString(),
            address,
            botState,
            log.args.eta.toString(),
            addresses,
          );
        case 'TimelockChange':
          return timelockChangeFinding(
            address,
            botState,
            log.args.oldTimelock,
            log.args.newTimelock,
            addresses,
          );
        case 'VotingDelaySet':
          return votingDelaySetFinding(
            address,
            botState,
            log.args.oldVotingDelay.toString(),
            log.args.newVotingDelay.toString(),
            addresses,
          );
        case 'VotingPeriodSet':
          return votingPeriodSetFinding(
            address,
            botState,
            log.args.oldVotingDelay.toString(),
            log.args.newVotingDelay.toString(),
            addresses,
          );
        case 'ProposalThresholdSet':
          return proposalThresholdSetFinding(
            address,
            botState,
            log.args.oldProposalThreshold.toString(),
            log.args.newProposalThreshold.toString(),
            addresses,
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
  validateConfig,
  initialize,
  handleTransaction,
};
