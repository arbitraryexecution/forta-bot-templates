const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const {
  getAbi,
  extractEventArgs,
  parseExpression,
  checkLogAgainstExpression,
} = require('./utils');

// get the Array of events for a given contract
function getEvents(contractEventConfig, currentContract, adminEvents, contracts) {
  const proxyName = contractEventConfig.proxy;
  let { events } = contractEventConfig;
  const eventInfo = [];

  let eventNames = [];
  if (events === undefined) {
    if (proxyName === undefined) {
      return {}; // no events for this contract
    }
  } else {
    eventNames = Object.keys(events);
  }

  if (proxyName) {
    // contract is a proxy, look up the events (if any) for the contract the proxy is pointing to
    const proxyEvents = adminEvents[proxyName].events;
    if (proxyEvents) {
      if (events === undefined) {
        events = { ...proxyEvents };
      } else {
        events = { ...events, ...proxyEvents };
      }

      // find the abi for the contract the proxy is pointing to and get the event signatures
      const [proxiedContract] = contracts.filter((contract) => proxyName === contract.name);
      Object.keys(proxyEvents).forEach((eventName) => {
        const eventObject = {
          name: eventName,
          // eslint-disable-next-line max-len
          signature: proxiedContract.iface.getEvent(eventName).format(ethers.utils.FormatTypes.full),
          type: proxyEvents[eventName].type,
          severity: proxyEvents[eventName].severity,
        };

        const { expression } = proxyEvents[eventName];
        if (expression !== undefined) {
          eventObject.expression = expression;
          eventObject.expressionObject = parseExpression(expression);
        }

        eventInfo.push(eventObject);
      });
    }
  }

  eventNames.forEach((eventName) => {
    const eventObject = {
      name: eventName,
      signature: currentContract.iface.getEvent(eventName).format(ethers.utils.FormatTypes.full),
      type: events[eventName].type,
      severity: events[eventName].severity,
    };

    const { expression } = events[eventName];
    if (expression !== undefined) {
      eventObject.expression = expression;
      eventObject.expressionObject = parseExpression(expression);
    }
    eventInfo.push(eventObject);
  });

  return { eventInfo };
}

// helper function to create alerts
function createAlert(
  eventName,
  contractName,
  contractAddress,
  eventType,
  eventSeverity,
  args,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  expression,
) {
  const eventArgs = extractEventArgs(args);
  const finding = Finding.fromObject({
    name: `${protocolName} Admin Event`,
    description: `The ${eventName} event was emitted by the ${contractName} contract`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-ADMIN-EVENT`,
    type: FindingType[eventType],
    severity: FindingSeverity[eventSeverity],
    protocol: protocolName,
    metadata: {
      contractName,
      contractAddress,
      eventName,
      ...eventArgs,
    },
  });

  if (expression !== undefined) {
    finding.description += ` with condition met: ${expression}`;
  }

  return Finding.fromObject(finding);
}

const initialize = async (config) => {
	let agentState = {};

	/* eslint-disable no-param-reassign */
	// assign configurable fields
	agentState.adminEvents = config.contracts;
	agentState.protocolName = config.protocolName;
	agentState.protocolAbbreviation = config.protocolAbbreviation;
	agentState.developerAbbreviation = config.developerAbbreviation;

	// load the contract addresses, abis, and ethers interfaces
	agentState.contracts = Object.entries(agentState.adminEvents).map(([name, entry]) => {
		if (entry.address === undefined) {
			throw new Error(`No address found in configuration file for '${name}'`);
		}
		if (entry.abiFile === undefined) {
			throw new Error(`No ABI file found in configuration file for '${name}'`);
		}

		const abi = getAbi(entry.abiFile);
		const iface = new ethers.utils.Interface(abi);

		const contract = { name, address: entry.address, iface, };
		return contract;
	});

	agentState.contracts.forEach((contract) => {
		const entry = agentState.adminEvents[contract.name];
		const { eventInfo } = getEvents(entry, contract, agentState.adminEvents, agentState.contracts);
		contract.eventInfo = eventInfo;
	});

	return agentState;
};

const handleTransaction = async (agentState, txEvent) => {
	if (!agentState.contracts) throw new Error('handleTransaction called before initialization');

	const findings = [];
	agentState.contracts.forEach((contract) => {
		contract.eventInfo.forEach((ev) => {
			const parsedLogs = txEvent.filterLog(ev.signature, contract.address);

			// iterate over each item in parsedLogs and evaluate expressions (if any) given in the
			// configuration file for each Event log, respectively
			parsedLogs.forEach((parsedLog) => {
				// if there is an expression to check, verify the condition before creating an alert
				if (ev.expression !== undefined) {
					if (!checkLogAgainstExpression(ev.expressionObject, parsedLog)) {
						return;
					}
				}

				findings.push(createAlert(
					ev.name,
					contract.name,
					contract.address,
					ev.type,
					ev.severity,
					parsedLog.args,
					agentState.protocolName,
					agentState.protocolAbbreviation,
					agentState.developerAbbreviation,
					ev.expression,
				));
			});
		});
	});

	return findings;
};

module.exports = {
  initialize,
  handleTransaction,
  createAlert,
};
