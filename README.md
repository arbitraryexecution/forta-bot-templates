# Forta Agent Templates

This repository contains Forta Agent templates that can be used to quickly create and deploy agents
simply by creating configuration files.

## Agent Templates

### Administrative/Governance Events

This agent monitors blockchain transactions for specific events emitted from specific contract
addresses.  Optionally, an expression can be provided for checking the value of an event argument
against a predefined value.  If a matching event is emitted and the expression evaluates to `true`,
an alert is created.  Alert type and severity are specified per event per contract address.

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
addresses. Optionally, an expression may be provided for checking the value of a function argument
against a predefined value.  If a matching function call occurs and the expression evaluates to
`true`, an alert is created.  Alert type and severity are specified per function per contract
address.

### Transaction Failure Count

This agent monitors blockchain transactions that have failed and are associated with a specific
contract address. Alert type and severity are both configurable.

### Contract Variable Monitor

This agent monitors contract variables that contain numeric values for specified contract addresses.
Upper and lower percent change thresholds, number of data points to collect before checking for percent changes,
and alert type and severity are specified per variable per contract address.

### Tornado Cash Monitor

This agent monitors blockchain transactions for those involving specified addresses and any address
that have previously interacted with a known Tornado Cash Proxy. An observation period (in blocks) to
watch addresses that have interacted with known Tornado Cash Proxies is configurable. Alert type and
severity is also configurable per contract.
