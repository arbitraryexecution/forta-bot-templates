# Transaction Failure Count Bot Template

This bot monitors the number of failed transactions to a specific contract addresses. Alert type
and severity are specified per contract address. An existing bot of this type may be modified to
to add/remove/update contracts in the bot configuration file.

## Bot Setup Walkthrough

1. `blockWindow` (required) - The Integer value for this key corresponds to how long failed
transactions should be counted against a contract's failed transactions limit before being removed.

2. `contracts` (required) - The Object value for this key corresponds to contracts that we
want to monitor the number of failed transactions for. Each key in the Object is a contract name that
we can specify, where that name is simply a string that we use as a label when referring to the contract
(the string can be any valid string that we choose, it will not affect the monitoring by the bot).
The Object corresponding to each contract name requires an address key/value pair, a key/value pair
for the limit of failed transactions allowed, a Finding type key/value pair, and a Finding severity
key/value pair (Note that using a Finding type and/or Finding severity that is not listed in the Forta SDK
will cause the bot to throw an error). For example, to monitor the Uniswap V3 Factory for failed transactions, we would need
the contract address, the number of failed transactions that are allowed to occur before an alert is
generated, and a type and severity for the alert:

```json
  "contracts": {
    "UniswapV3Factory": {
      "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      "transactionFailuresLimit": 2,
      "type": "Info",
      "severity": "Medium"
    }
  }
```

Note that any unused entries in the configuration file must be deleted for the bot to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the bot.
