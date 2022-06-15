# Account Balance Bot Template

This bot monitors the account balances (in Ether) of addresses on the blockchain and creates an alert when
the balance falls below a specified threshold value. Threshold, alert type, and alert severity are specified
per address.  An existing bot of this type may be modified to add/remove/update addresses in the bot
configuration file.

## Bot Setup Walkthrough

1. `accountBalance` (required) - The Object value for this key corresponds to addresses for which we want to monitor
the account balance.  Each key in the Object is a name that we can specify, where that name is simply a string that
we use as a label when referring to the address (the string can be any valid string that we choose, it will not
affect the monitoring by the bot).  The Object corresponding to each name requires an address key/value pair, a
thresholdEth key and integer value, a type key and string value, and a severity key and string value for the alert.
For example, to monitor the Uni contract Ether balance, we would need the address, the threshold value,
and a type and severity for the alert (must be valid type and severity from Forta SDK):

```json
  "accountBalance": {
    "Uni": {
      "address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "thresholdEth": 3,
      "type": "Suspicious",
      "severity": "High" 
    }
  }
```

Note that any unused entries in the configuration file must be deleted for the bot to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the bot.

2. `alertMinimumIntervalSeconds` (required) - Type in the minimum number of seconds between sending alerts.  This
value is necessary to avoid sending too many alerts for the same condition in each block.  The default behavior
is for the bot to emit an alert when the condition is met, keep a counter of how many alerts would have happened
within the interval specified, then emit an alert once that interval has been exceeded.  The subsequent emitted
alert will contain the number of alerts that would have occurred during that interval.
