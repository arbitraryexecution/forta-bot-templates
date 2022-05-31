# Forta Bot Templates

This repository contains Forta Bot templates that can be used to quickly create and deploy bots
simply by creating configuration files. These Bot templates were designed by [Arbitrary Execution](https://www.arbitraryexecution.com/).
More projects are available on [Arbitrary Execution's Github](https://github.com/arbitraryexecution)

## Bot Setup Walkthrough

The following steps will take you from a completely blank template to a functional bot.

1. Copy the `bot-config.json.example` file to a new file named `bot-config.json`.

2. `developerAbbreviation` (required) - Type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

3. `protocolName` (required) - Type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the SushiSwap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

4. `protocolAbbreviation` (required) - Type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"SushiSwap"` may be abbreviated `"SUSH"`, etc.

5. `gatherMode` (required) - This can either be `any`, or `all`.
- `any` returns any/all findings, for any bot added the the template list.
- `all` returns findings only if all bots had findings for that transaction **and** containing block

6. `bots` (required) - This is where you stick config information for all bots you'd like to run.
Check the appropriate Bot Templates setup for more details on each one.

## Validating Your Config

Once you're ready to deploy, `npm run validate` will check that your `bot-config.json` file is ready to go,
and should let you know if there's any issues that might pop up during your run

## Bot Templates

### [Event Monitor](src/monitor-events/SETUP.md)

This bot monitors blockchain transactions for specific events emitted from specific contract
addresses. Optionally, an expression can be provided for checking the value of an event argument
against a predefined value. If a matching event is emitted and the expression evaluates to `true`,
an alert is created. Alert type and severity are specified per event per contract address.

### [Account Balance Monitor](src/account-balance/SETUP.md)

This bot monitors the account balance (in Ether) of specific addresses. Thresholds, alert type,
and alert severity are specified per address. There is also a minimum alert interval that prevents
the bot from emitting many alerts for the same condition.

### [Address Watch](src/address-watch/SETUP.md)

This bot monitors blockchain transactions for those involving specific addresses, which may be
either EOAs or contracts. Alert type and severity are both configurable.

### [Function Call Monitor](src/monitor-function-calls/SETUP.md)

This bot monitors blockchain transactions for specific function calls for specific contract
addresses. Optionally, an expression may be provided for checking the value of a function argument
against a predefined value. If a matching function call occurs and the expression evaluates to
`true`, an alert is created. Alert type and severity are specified per function per contract
address.

### [Transaction Failure Count](src/transaction-failure-count/SETUP.md)

This bot monitors blockchain transactions that have failed and are associated with a specific
contract address. Alert type and severity are both configurable.

### [New Contract/EOA Interaction](src/new-contract-interaction/SETUP.md)

This bot monitors blockchain transactions for new contracts and EOAs with few transactions
interacting with specific contract addresses. Alert type and severity are specified per contract.

### [Governance Event Monitor](src/governance/SETUP.md)

This bot monitors governance contracts that use the modular system of Governance contracts available
from OpenZeppelin. All possible emitted events are coded into the logic of the bot, so a developer
need only specify the appropriate ABI file (files all present in the repository) and contract address.
All alert types and severities are set to Info.

### [Gnosis-Safe MultiSig Monitor](src/gnosis-safe-multisig/SETUP.md)

This bot monitors a Gnosis-Safe MultiSig contract for emitted events and for any balance changes in
Ether or ERC20 tokens. Gnosis-Safe MultiSig contract versions v1.0.0, v1.1.1, v1.2.0, and v1.3.0 are
supported and the appropriate ABI files are all present in the repository. All alert types and
severities are set to Info.

### [Contract Variable Monitor](src/contract-variable-monitor/SETUP.md)

This bot monitors contract variables that contain numeric values for specified contract addresses.
Upper and lower percent change thresholds, number of data points to collect before checking for percent changes,
and alert type and severity are specified per variable per contract address.

### [Tornado Cash Monitor](src/tornado-cash-monitor/SETUP.md)

This bot monitors blockchain transactions for those involving specified addresses and any address
that have previously interacted with a known Tornado Cash Proxy. An observation period (in blocks) to
watch addresses that have interacted with known Tornado Cash Proxies is configurable. Alert type and
severity is also configurable per contract.
