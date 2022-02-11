# Forta Agent Templates

This repository contains Forta Agent templates that can be used to quickly create and deploy agents
simply by creating configuration files.

## Agent Templates

### Event Monitor

This agent monitors blockchain transactions for specific events emitted from specific contract
addresses.  Optionally, the value of an argument per event can be checked against a user-defined
threshold.  Alert type and severity are specified per event per contract address.

### Account Balance Monitor

This agent monitors the account balance (in Ether) of specific addresses.  Thresholds, alert type,
and alert severity are specified per address.  There is also a minimum alert interval that prevents
the agent from emitting many alerts for the same condition.

### Address Watch

This agent monitors blockchain transactions for those involving specific addresses, which may be
either EOAs or contracts.  Alert type and severity are both configurable.

### Function Call Monitor

This agent monitors blockchain transactions for specific function calls for specific contract
addresses. Optionally, the value of an argument per function call can be checked against a user-
defined threshold.  Alert type and severity are specified per function per contract address.

### Transaction Failure Count

This agent monitors blockchain transactions that have failed and are associated with a specific
contract address. Alert type and severity are both configurable.

### Governance Event Monitor

This agent monitors governance contracts that use the modular system of Governance contracts available
from OpenZeppelin.  All possible emitted events are coded into the logic of the agent, so a developer
need only specify the appropriate ABI file (files all present in the repository) and contract address.
All alert types and severities are set to Info.

### Gnosis-Safe MultiSig Monitor

This agent monitors a Gnosis-Safe MultiSig contract for emitted events and for any balance changes in
Ether or ERC20 tokens.  Gnosis-Safe MultiSig contract versions v1.0.0, v1.1.1, v1.2.0, and v1.3.0 are
supported and the appropriate ABI files are all present in the repository.  All alert types and
severities are set to Info.
