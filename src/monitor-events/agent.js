const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
} = require("forta-agent");

const {
  getAbi,
  buildAbiPath,
  extractEventArgs,
  parseExpression,
  checkLogAgainstExpression,
  isFilledString,
  isAddress,
  isObject,
  isEmptyObject,
} = require("../utils");
const { getObjectsFromAbi } = require("../test-utils");

let VAULT_STATUS_IRR = 0;

let findingsCache = [];
let isTaskRunning = false;

const runLongTask = async (botState, txEvent) => {
  isTaskRunning = true;

  // long-running code goes here and adds any findings to findingsCache
  botState.contracts.forEach((contract) => {
    contract.eventInfo.forEach((ev) => {
      const parsedLogs = txEvent.filterLog(ev.signature, contract.address);

      let addresses = Object.keys(txEvent.addresses).map((address) =>
        address.toLowerCase()
      );
      addresses = addresses.filter((address) => address !== "undefined");

      parsedLogs.forEach((parsedLog) => {
        if (
          parsedLog.args["deposit0Max"].isZero() ||
          parsedLog.args["deposit1Max"].isZero()
        ) {
          VAULT_STATUS_IRR = 0;
          console.log(`${contract.address} turned off`);
              findings.push(
                createAlert(
                  ev.name,
                  contract.name,
                  contract.address,
                  ev.type,
                  ev.severity,
                  parsedLog.args,
                  botState.protocolName,
                  botState.protocolAbbreviation,
                  botState.developerAbbreviation,
                  ev.expression,
                  addresses
                )
              );
          return;
        }

        if (
          !parsedLog.args["deposit0Max"].isZero() ||
          !parsedLog.args["deposit1Max"].isZero()
        ) {
          VAULT_STATUS_IRR = 1;
          console.log(`${parsedLog.address} turned on`);
          return;
        }
      });
    });
  });

  isTaskRunning = false;
};

// get the Array of events for a given contract
function getEvents(
  contractEventConfig,
  currentContract,
  monitorEvents,
  contracts
) {
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
    const proxyEvents = monitorEvents[proxyName].events;
    if (proxyEvents) {
      if (events === undefined) {
        events = { ...proxyEvents };
      } else {
        events = { ...events, ...proxyEvents };
      }

      // find the abi for the contract the proxy is pointing to and get the event signatures
      const [proxiedContract] = contracts.filter(
        (contract) => proxyName === contract.name
      );
      Object.keys(proxyEvents).forEach((eventName) => {
        const eventObject = {
          name: eventName,
          // eslint-disable-next-line max-len
          signature: proxiedContract.iface
            .getEvent(eventName)
            .format(ethers.utils.FormatTypes.full),
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
      signature: currentContract.iface
        .getEvent(eventName)
        .format(ethers.utils.FormatTypes.full),
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
  addresses
) {
  const eventArgs = extractEventArgs(args);
  const finding = Finding.fromObject({
    name: `${protocolName} Monitor Event`,
    description: `The ${eventName} event was emitted by the ${contractName} contract`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MONITOR-EVENT`,
    type: FindingType[eventType],
    severity: FindingSeverity[eventSeverity],
    protocol: protocolName,
    addresses,
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
    errMsg = "developerAbbreviation required";
    return { ok, errMsg };
  }
  if (!isFilledString(config.protocolName)) {
    errMsg = "protocolName required";
    return { ok, errMsg };
  }
  if (!isFilledString(config.protocolAbbreviation)) {
    errMsg = "protocolAbbreviation required";
    return { ok, errMsg };
  }

  const { contracts } = config;
  if (!isObject(contracts) || isEmptyObject(contracts)) {
    errMsg = "contracts key required";
    return { ok, errMsg };
  }

  let entry;
  const entries = Object.entries(contracts);
  for (let i = 0; i < entries.length; i += 1) {
    [, entry] = entries[i];
    const { address, abiFile, events } = entry;

    // check that the address is a valid address
    if (!isAddress(address)) {
      errMsg = "invalid address";
      return { ok, errMsg };
    }

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    let abi;
    if (abiOverride != null) {
      abi = abiOverride[abiFile];
    } else {
      try {
        abi = getAbi(config.name, abiFile);
      } catch (error) {
        console.error(error);
        const path = buildAbiPath(config.name, abiFile);
        errMsg = `Unable to get abi file! ${path}`;
        return { ok, errMsg };
      }
    }

    const eventObjects = getObjectsFromAbi(abi, "event");

    // for all of the events specified, verify that they exist in the ABI
    let eventName;
    const eventNames = Object.keys(events);
    for (let j = 0; j < eventNames.length; j += 1) {
      eventName = eventNames[j];
      if (Object.keys(eventObjects).indexOf(eventName) === -1) {
        errMsg = "invalid event";
        return { ok, errMsg };
      }

      const { expression, type, severity } = events[eventName];

      // the expression key can be left out, but if it's present, verify the expression
      if (expression !== undefined) {
        // if the expression is not valid, the call to parseExpression will fail
        const expressionObject = parseExpression(expression);

        // check the event definition to verify the argument name
        const { inputs } = eventObjects[eventName];
        const argumentNames = inputs.map((inputEntry) => inputEntry.name);

        // verify that the argument name is present in the event Object
        if (argumentNames.indexOf(expressionObject.variableName) === -1) {
          errMsg = "invalid argument";
          return { ok, errMsg };
        }
      }

      // check type, this will fail if 'type' is not valid
      if (!Object.prototype.hasOwnProperty.call(FindingType, type)) {
        errMsg = "invalid finding type!";
        return { ok, errMsg };
      }

      // check severity, this will fail if 'severity' is not valid
      if (!Object.prototype.hasOwnProperty.call(FindingSeverity, severity)) {
        errMsg = "invalid finding severity!";
        return { ok, errMsg };
      }
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config, abiOverride = null) => {
  const botState = { ...config };

  const { ok, errMsg } = validateConfig(config, abiOverride);
  if (!ok) {
    throw new Error(errMsg);
  }

  botState.monitorEvents = config.contracts;

  // load the contract addresses, abis, and ethers interfaces
  botState.contracts = Object.entries(botState.monitorEvents).map(
    ([name, entry]) => {
      let abi;
      if (abiOverride != null) {
        abi = abiOverride[entry.abiFile];
      } else {
        abi = getAbi(config.name, entry.abiFile);
      }
      const iface = new ethers.utils.Interface(abi);

      const contract = { name, address: entry.address, iface };
      return contract;
    }
  );

  botState.contracts.forEach((contract) => {
    const entry = botState.monitorEvents[contract.name];
    const { eventInfo } = getEvents(
      entry,
      contract,
      botState.monitorEvents,
      botState.contracts
    );
    // eslint-disable-next-line no-param-reassign
    contract.eventInfo = eventInfo;
  });

  return botState;
};

const handleTransaction = async (botState, txEvent) => {
  if (!botState.contracts)
    throw new Error("handleTransaction called before initialization");

  let findings = [];

  // make sure only one task is running at a time
  if (!isTaskRunning) {
    runLongTask(botState, txEvent);
  }

  // check if we have any findings cached
  if (findingsCache.length > 0) {
    findings = findingsCache;
    findingsCache = [];
  }

  return findings;
};

module.exports = {
  validateConfig,
  createAlert,
  initialize,
  handleTransaction,
};
