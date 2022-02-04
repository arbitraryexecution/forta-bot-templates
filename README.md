# Forta Agent Templates

This repository contains Forta Agent templates that can be used to quickly create and deploy agents
simply by creating configuration files.

## Agent Templates

### Administrative/Governance Events

This agent monitors blockchain transactions for specific events emitted from specific contract
addresses.  Alert type and severity are specified per event per contract address.  An existing agent
of this type may be modified to add/remove/update events and contracts in the agent configuration
file.

### Account Balance Monitor

This agent monitors the account balance (in Ether) of specific addresses.  Thresholds, alert type,
and alert severity are specified per address.  There is also a minimum alert interval that prevents
the agent from emitting many alerts for the same condition.  An existing agent of this type may be
modified to add/remove/update addresses and threshold in the agent configuration file.

### Address Watch

This agent monitors blockchain transactions for those involving specific addresses, which may be
either EOAs or contracts.  Alert type and severity are both configurable.

### Function Calls

This agent monitors blockchain transactions for specific function calls for specific contract
addresses. Alert type and severity are specified per function per contract address.

### Transaction Failure Count

This agent monitors blockchain transactions that have failed and are associated with a specific
contract address. Alert type and severity are both configurable.

### Contract Variable Monitor

This agent monitors contract variable values for specified contract addresses. Alert type and severity
are specified per variable per contract address.
