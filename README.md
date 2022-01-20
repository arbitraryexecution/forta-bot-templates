# Forta Agent Templates

This repository contains a JavaScript (JS) command line utility (CLI) that allows a user to interactively create Forta Agents.

## Agent Templates

### Administrative/Governance Events

This agent monitors blockchain transactions for specific events emitted from specific contract addresses.  Alert 
type and severity are specified per event per contract address.  An existing agent of this type may be modified 
to add/remove/update events and contracts in the agent configuration file.

### Account Balance Monitor

This agent monitors the account balance (in Ether) of specific addresses.  Thresholds, alert type, and alert
severity are specified per address.  There is also a minimum alert interval that prevents the agent from emitting
many alerts for the same condition.  An existing agent of this type may be modified to add/remove/update addresses
and threshold in the agent configuration file.
