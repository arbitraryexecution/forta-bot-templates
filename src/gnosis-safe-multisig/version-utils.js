function getFindings(version, eventName, protocolName, protocolAbbreviation, developerAbbreviation, address, args) {

  const addedOwnerObject = {
    name: `${protocolName} DAO Treasury MultiSig - AddedOwner`,
    description: `Owner added to Gnosis-Safe MultiSig wallet: ${args.owner}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-ADDED-OWNER`,
    metadata: {
      address,
      owner: args.owner,
    },
  };

  const approveHashObject = {
    name: `${protocolName} DAO Treasury MultiSig - ApproveHash`,
    description: `Hash ${args.approvedHash} marked as approved by owner ${args.owner}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-APPROVE-HASH`,
    metadata: {
      address,
      owner: args.owner,
      approvedHash: args.approvedHash,
    },
  };

  const payment = args.payment ? args.payment.toString() : '';
  const executionFailureObject = {
    name: `${protocolName} DAO Treasury MultiSig - ExecutionFailure`,
    description: `Failed to execute transaction with hash ${args.txHash}, payment ${payment}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-EXECUTION-FAILURE`,
    metadata: {
      address,
      txHash: args.txHash,
      payment,
    },
  };

  const executionSuccessObject = {
    name: `${protocolName} DAO Treasury MultiSig - ExecutionSuccess`,
    description: `Succeeded executing transaction with hash ${args.txHash}, payment ${payment}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-EXECUTION-SUCCESS`,
    metadata: {
      address,
      txHash: args.txHash,
      payment,
    },
  };

  const executionFromModuleFailureObject = {
    name: `${protocolName} DAO Treasury MultiSig - ExecutionFromModuleFailure`,
    description: `Failed executing transaction using module: ${args.module}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-EXECUTION-FROM-MODULE-FAILURE`,
    metadata: {
      address,
      module: args.module,
    },
  };

  const executionFromModuleSuccessObject = {
    name: `${protocolName} DAO Treasury MultiSig - ExecutionFromModuleSuccess`,
    description: `Succeeded executing transaction using module: ${args.module}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-EXECUTION-FROM-MODULE-SUCCESS`,
    metadata: {
      address,
      module: args.module,
    },
  };

  const removedOwnerObject = {
    name: `${protocolName} DAO Treasury MultiSig - RemovedOwner`,
    description: `Owner removed from Gnosis-Safe MultiSig wallet: ${args.owner}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-REMOVED-OWNER`,
    metadata: {
      address,
      owner: args.owner,
    },
  };

  const threshold = args.threshold ? args.threshold.toString() : '';
  const changedThresholdObject = {
    name: `${protocolName} DAO Treasury MultiSig - ChangedThreshold`,
    description: `Number of required confirmation changed to ${threshold}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-CHANGED-THRESHOLD`,
    metadata: {
      address,
      threshold,
    },
  };

  const safeSetupObject = {
    name: `${protocolName} DAO Treasury MultiSig - SafeSetup`,
    description: `Initialized storage of contract by ${args.initiator} with threshold ${threshold}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-SAFE-SETUP`,
    metadata: {
      address,
      initiator: args.initiator,
      owners: args.owners,
      threshold,
      initializer: args.initializer,
      fallbackHandler: args.fallbackHandler,
    },
  };

  const enabledModuleObject = {
    name: `${protocolName} DAO Treasury MultiSig - EnabledModule`,
    description: `Module ${args.module} added to the whitelist`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-ENABLED-MODULE`,
    metadata: {
      address,
      module: args.module,
    },
  };

  const disabledModuleObject = {
    name: `${protocolName} DAO Treasury MultiSig - DisabledModule`,
    description: `Module ${args.module} removed from the whitelist`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-DISABLED-MODULE`,
    metadata: {
      address,
      module: args.module,
    },
  };

  const signMsgObject = {
    name: `${protocolName} DAO Treasury MultiSig - SignMsg`,
    description: `Message signed, hash: ${args.msgHash}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-SIGN-MSG`,
    metadata: {
      address,
      msgHash: args.msgHash,
    },
  };

  const changedMasterCopyObject = {
    name: `${protocolName} DAO Treasury MultiSig - ChangedMasterCopy`,
    description: `Migrated contract, master copy address: ${args.masterCopy}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-CHANGED-MASTER-COPY`,
    metadata: {
      address,
      masterCopy: args.masterCopy,
    },
  };

  const executionFailedObject = {
    name: `${protocolName} DAO Treasury MultiSig - ExecutionFailed`,
    description: `Failed to execute transaction with hash ${args.txHash}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-EXECUTION-FAILED`,
    metadata: {
      address,
      txHash: args.txHash,
    },
  };

  const contractCreationObject = {
    name: `${protocolName} DAO Treasury MultiSig - ContractCreation`,
    description: `New contract deployed at address ${args.newContract}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-CONTRACT-CREATION`,
    metadata: {
      address,
      newContract: args.newContract,
    },
  };

  const changedFallbackHandlerObject = {
    name: `${protocolName} DAO Treasury MultiSig - ChangedFallbackHandler`,
    description: `Fallback handler changed to ${args.handler}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-CHANGED-FALLBACK-HANDLER`,
    metadata: {
      address,
      handler: args.handler,
    },
  };

  const changedGuardObject = {
    name: `${protocolName} DAO Treasury MultiSig - ChangedGuard`,
    description: `Guard that checks transactions before execution changed to ${args.guard}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-CHANGED-GUARD`,
    metadata: {
      address,
      guard: args.guard,
    },
  };

  const value = args.value ? args.value.toString() : '';
  const safeReceivedObject = {
    name: `${protocolName} DAO Treasury MultiSig - SafeReceived`,
    description: `Safe received ether payments via fallback method.  Sender: ${args.sender}, Value: ${value}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-SAFE-RECEIVED`,
    metadata: {
      address,
      sender: args.sender,
      value,
    },
  };

  const findingsObjects = {
    'v1.0.0': {
      AddedOwner: addedOwnerObject,
      RemovedOwner: removedOwnerObject,
      ChangedThreshold: changedThresholdObject,
      EnabledModule: enabledModuleObject,
      DisabledModule: disabledModuleObject,
      ExecutionFailed: executionFailedObject,
      ContractCreation: contractCreationObject,
    },
    'v1.1.1': {
      AddedOwner: addedOwnerObject,
      RemovedOwner: removedOwnerObject,
      ChangedThreshold: changedThresholdObject,
      EnabledModule: enabledModuleObject,
      DisabledModule: disabledModuleObject,
      ApproveHash: approveHashObject,
      ChangedMasterCopy: changedMasterCopyObject,
      ExecutionFailure: executionFailureObject,
      ExecutionFromModuleFailure: executionFromModuleFailureObject,
      ExecutionFromModuleSuccess: executionFromModuleSuccessObject,
      ExecutionSuccess: executionSuccessObject,
      SignMsg: signMsgObject,
    },
    'v1.2.0': {
      AddedOwner: addedOwnerObject,
      RemovedOwner: removedOwnerObject,
      ChangedThreshold: changedThresholdObject,
      EnabledModule: enabledModuleObject,
      DisabledModule: disabledModuleObject,
      ApproveHash: approveHashObject,
      ChangedMasterCopy: changedMasterCopyObject,
      ExecutionFailure: executionFailureObject,
      ExecutionFromModuleFailure: executionFromModuleFailureObject,
      ExecutionFromModuleSuccess: executionFromModuleSuccessObject,
      ExecutionSuccess: executionSuccessObject,
      SignMsg: signMsgObject,
    },
    'v1.3.0': {
      AddedOwner: addedOwnerObject,
      RemovedOwner: removedOwnerObject,
      ChangedThreshold: changedThresholdObject,
      EnabledModule: enabledModuleObject,
      DisabledModule: disabledModuleObject,
      ApproveHash: approveHashObject,
      ChangedFallbackHandler: changedFallbackHandlerObject,
      ChangedGuard: changedGuardObject,
      ExecutionFailure: executionFailureObject,
      ExecutionFromModuleFailure: executionFromModuleFailureObject,
      ExecutionFromModuleSuccess: executionFromModuleSuccessObject,
      ExecutionSuccess: executionSuccessObject,
      SafeReceived: safeReceivedObject,
      SafeSetup: safeSetupObject,
      SignMsg: signMsgObject,
    },
  };

  const findingObject = findingsObjects[version][eventName];

  return findingObject;
}

module.exports = {
  getFindings,
};
