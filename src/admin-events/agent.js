const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

const {
  getAbi,
  extractEventArgs,
  parseExpression,
  checkLogAgainstExpression,
  isFilledString,
  isAddress,
  isObject,
  isEmptyObject
} = require('../utils');
const { getObjectsFromAbi } = require("../test-utils");

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

  for (const [name, entry] of Object.entries(contracts)) {
    const { address, abiFile, events } = entry;

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

    const eventObjects = getObjectsFromAbi(abi, 'event');

    // for all of the events specified, verify that they exist in the ABI
    for (const eventName of Object.keys(events)) {
      if (Object.keys(eventObjects).indexOf(eventName) == -1) {
        errMsg = `invalid event`;
        return { ok, errMsg };
      }

      const entry = events[eventName];
      const { expression, type, severity } = entry;

      // the expression key can be left out, but if it's present, verify the expression
      if (expression !== undefined) {
        // if the expression is not valid, the call to parseExpression will fail
        const expressionObject = parseExpression(expression);

        // check the event definition to verify the argument name
        const { inputs } = eventObjects[eventName];
        const argumentNames = inputs.map((inputEntry) => inputEntry.name);

        // verify that the argument name is present in the event Object
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
  let agentState = {...config};

  const { ok, errMsg } = validateConfig(config, abiOverride);
  if (!ok) {
    throw new Error(errMsg);
  }

  agentState.adminEvents = config.contracts;

  // load the contract addresses, abis, and ethers interfaces
  agentState.contracts = Object.entries(agentState.adminEvents).map(([name, entry]) => {
    let abi;
    if (abiOverride != null) {
      abi = abiOverride[entry.abiFile];
    } else {
      abi = getAbi(config.name, entry.abiFile);
    }
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
  validateConfig,
  createAlert,
  initialize,
  handleTransaction,
};
