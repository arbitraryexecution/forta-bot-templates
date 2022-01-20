# Forta Agent Templates

This repository contains a JavaScript (JS) command line utility (CLI) that allows a user to interactively create Forta Agents.

## Agent Templates

### Administrative/Governance Events

This agent monitor blockchain transactions for specific events emitted from specific contract addresses.  Alert 
type and severity are specified per event per contract address.  An existing agent of this type may be modified 
to add/remove/update events and contracts in the agent configuration file.

### Address Watch

This agent monitors blockchain transactions for those involving specific addresses, which may be either EOAs or contracts.
Alert type and severity are both configurable.  An existing agent of this type may be modified to add/remove/update
addresses in the agent configuration file.