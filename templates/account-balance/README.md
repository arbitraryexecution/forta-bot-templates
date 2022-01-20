# Account Balance Agent Template

This agent monitors the account balances (in Ether) of addresses on the blockchain and creates an alert when
the balance falls below a specified threshold value. Threshold, alert type, and alert severity are specified
per address.  An existing agent of this type may be modified to add/remove/update addresses in the agent
configuration file.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.

1. Open the `agent-config.json` file.

1. `everestId` (optional) - Navigate to `https://everest.link` to look up the Everest registry ID for a
specific project.  For example, typing `Uniswap` into the search bar (revealed when you click the magnifying glass
at the top of the page), returns a number of potential matches, one of which is the correct Uniswap entry.  The ID
for that entry is `0xa2e07f422b5d7cbbfca764e53b251484ecf945fa`.  Copy and paste the Everest registry ID into the
`agent-config.json` file as the value for the key `everestId`.

1. `developerAbbreviation` (required) - Type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

1. `protocolName` (required) - Type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the SushiSwap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

1. `protocolAbbreviation` (required) - Type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"SushiSwap"` may be abbreviated `"SUSH"`, etc.

1. `accountBalance` (required) - The Object value for this key corresponds to contracts for which we want to monitor
the account balance.  Each key in the Object is a contract name that we can specify, where that name is simply a
string that we use as a label when referring to the contract (the string can be any valid string that we choose, it
will not affect the monitoring by the agent).  The Object corresponding to each contract name requires an address
key/value pair, a thresholdEth key and integer value, and an alert key with an Object value that specifies the type
and severity of the alert.  For example, to monitor the Uni contract Ether balance, we would need the contract
address, the threshold value, and a type and severity for the alert:

```
  "accountBalance": {
    "Uni": {
      "address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "thresholdEth": 3,
      "alert": { "type": "Suspicious", "severity": "High" }
    } 
  }
```

Note that any unused entries in the configuration file must be deleted for the agent to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the agent.

1. `alertMinimumIntervalSeconds` (required) - Type in the minimum number of seconds between sending alerts.  This
value is necessary to avoid sending too many alerts for the same condition in each block.  The default behavior
is for the agent to emit an alert when the condition is met, keep a counter of how many alerts would have happened
within the interval specified, then emit an alert once that interval has been exceeded.  The subsequent emitted
alert will contain the number of alerts that would have occurred during that interval.

1. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the `name` and `description` entries in the `package.json` file to appropriately
reflect who is creating the agent and what the agent monitors.

1. Move files to have the following directory structure:

```
  account-balance/
    README.md
    Dockerfile
    forta.config.json
    package.json
    agent-config.json
    src/
      agent.js
```

1. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

1. Once the `agent-config.json` file is populated, the agent is complete.  Please test the agent against transactions
that contain events that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.  Although not provided here, please create tests that will verify the functionality of
the agent code for positive cases, negative cases, and edge cases (e.g. when errors occur).

1. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation.