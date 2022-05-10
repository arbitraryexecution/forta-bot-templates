# New Contract Interaction Bot Template

This bot monitors blockchain transactions for new contracts and EOAs with few transactions
interacting with specific contract addresses. Alert type and severity are specified per contract.

## Bot Setup Walkthrough

1. `contracts` (required) - The Object value for this key corresponds to contracts that we want to
monitor for interactions with new EOAs and/or contracts. Each key in the Object is a contract name
that we can specify, where that name is simply a string that we use as a label when referring to the
contract (the string can be any valid string that we choose, it will not affect the monitoring by the
bot). The corresponding value for the contract name is an Object containing:
    * thresholdBlockCount (required) - integer, number of blocks a contract must be newer than to trigger an alert
    * thresholdTransactionCount (required) - integer, number of transactions an EOA must be lower than to trigger an alert
    * address (required) - string, contract address to monitor for interactions
    * filteredAddresses (optional) - array, list of addresses to exclude from interaction alerts
    * findingType (required) - string, Forta Finding Type
    * findingSeverity (required) - string, Forta Finding Severity

For example, to monitor if the Uniswap V3 Factory contract was interacted with we would need the following: an age threshold, a transaction count threshold, a contract address, a type, and severity:

```json
  "contracts": {
    "UniswapV3Factory": {
      "thresholdBlockCount": 7,
      "thresholdTransactionCount": 7,
      "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      "filteredAddress": [],
      "findingType": "Suspicious",
      "findingSeverity": "Medium",
    }
  }
```

Note that any unused entries in the configuration file must be deleted for the bot to work.  The
original version of the configuration file contains several placeholders to show the structure of
the file, but these are not valid entries for running the bot.
