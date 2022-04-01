# Forta Agent Templates

This repository contains Forta Agent templates that can be used to quickly create and deploy agents
simply by creating configuration files. These Agent templates were designed by [Arbitrary Execution](https://www.arbitraryexecution.com/). More projects are available on [Arbitrary Execution's Github](https://github.com/arbitraryexecution)

## Agent Templates

### Event Monitor

This agent monitors blockchain transactions for specific events emitted from specific contract
addresses. Optionally, an expression can be provided for checking the value of an event argument
against a predefined value. If a matching event is emitted and the expression evaluates to `true`,
an alert is created. Alert type and severity are specified per event per contract address.

### [Account Balance Monitor](account-balance/SETUP.md)

This agent monitors the account balance (in Ether) of specific addresses. Thresholds, alert type,
and alert severity are specified per address. There is also a minimum alert interval that prevents
the agent from emitting many alerts for the same condition.

### [Address Watch](address-watch/SETUP.md)

This agent monitors blockchain transactions for those involving specific addresses, which may be
either EOAs or contracts. Alert type and severity are both configurable.

### [Function Call Monitor](monitor-function-call/SETUP.md)

This agent monitors blockchain transactions for specific function calls for specific contract
addresses. Optionally, an expression may be provided for checking the value of a function argument
against a predefined value. If a matching function call occurs and the expression evaluates to
`true`, an alert is created. Alert type and severity are specified per function per contract
address.

### [Transaction Failure Count](transaction-failure-count/SETUP.md)

This agent monitors blockchain transactions that have failed and are associated with a specific
contract address. Alert type and severity are both configurable.

### [New Contract/EOA Interaction](new-contract-interaction/SETUP.md)

This agent monitors blockchain transactions for new contracts and EOAs with few transactions
interacting with specific contract addresses. Alert type and severity are specified per contract.

### [Governance Event Monitor](governance/SETUP.md)

This agent monitors governance contracts that use the modular system of Governance contracts available
from OpenZeppelin. All possible emitted events are coded into the logic of the agent, so a developer
need only specify the appropriate ABI file (files all present in the repository) and contract address.
All alert types and severities are set to Info.

### [Gnosis-Safe MultiSig Monitor](gnosis-safe-multisig/SETUP.md)

This agent monitors a Gnosis-Safe MultiSig contract for emitted events and for any balance changes in
Ether or ERC20 tokens. Gnosis-Safe MultiSig contract versions v1.0.0, v1.1.1, v1.2.0, and v1.3.0 are
supported and the appropriate ABI files are all present in the repository. All alert types and
severities are set to Info.

### [Contract Variable Monitor](contract-variable-monitor/SETUP.md)

This agent monitors contract variables that contain numeric values for specified contract addresses.
Upper and lower percent change thresholds, number of data points to collect before checking for percent changes,
and alert type and severity are specified per variable per contract address.

### [Tornado Cash Monitor](tornado-cash-monitor/SETUP.md)

This agent monitors blockchain transactions for those involving specified addresses and any address
that have previously interacted with a known Tornado Cash Proxy. An observation period (in blocks) to
watch addresses that have interacted with known Tornado Cash Proxies is configurable. Alert type and
severity is also configurable per contract.
