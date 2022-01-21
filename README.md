# Forta Agent Templates

This repository contains Forta Agent templates that can be used to quickly create and deploy agents simply by creating configuration files.

## Agent Templates

### Administrative/Governance Events

This agent monitor blockchain transactions for specific events emitted from specific contract addresses.  Alert 
type and severity are specified per event per contract address. 

### Address Watch

This agent monitors blockchain transactions for those involving specific addresses, which may be either EOAs or contracts.
Alert type and severity are both configurable.

### Function Calls

This agent monitors blockchain transactions for specific function calls called from specific contract
addresses. Alert type and severity are specified per function per contract address.

### Transaction Failure Count

This agent monitors blockchain transactions that have failed and are associated with a specific
contract address. Alert type and severity are both configurable.
