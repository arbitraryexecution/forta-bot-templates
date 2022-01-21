# Transaction Failure Count Agent Template

This agent monitors the number of failed transactions to a specific contract addresses. Alert type
and severity are specified per contract address. An existing agent of this type may be modified to
to add/remove/update contracts in the agent configuration file.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.

1. Open the `agent-config.json` file.

2. `everestId` (optional) - Navigate to `https://everest.link` to look up the Everest registry ID for a
specific project.  For example, typing `Uniswap` into the search bar (revealed when you click the magnifying glass
at the top of the page), returns a number of potential matches, one of which is the correct Uniswap entry.  The ID
for that entry is `0xa2e07f422b5d7cbbfca764e53b251484ecf945fa`.  Copy and paste the Everest registry ID into the
`agent-config.json` file as the value for the key `everestId`.

3. `developerAbbreviation` (required) - Type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

4. `protocolName` (required) - Type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the SushiSwap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

5. `protocolAbbreviation` (required) - Type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"SushiSwap"` may be abbreviated `"SUSH"`, etc.

6. `blockWindow` (required) - The Integer value for this key corresponds to how long failed
transactions should be counted against a contract's failed transactions limit before being removed.

7.  `failedTransactions` (required) - The Object value for this key corresponds to contracts that we
want to monitor the number of failed transactions for. Each key in the Object is a contract name that
we can specify, where that name is simply a string that we use as a label when referring to the contract
(the string can be any valid string that we choose, it will not affect the monitoring by the agent).
The Object corresponding to each contract name requires an address key/value pair, a key/value pair
for the limit of failed transctions allowed, a Finding type key/value pair, and a Finding severity
key/value pair (Note that using a Finding type and/or Finding severity that is not listed in the Forta SDK
will cause the agent to throw an error). For example, to monitor the Uniswap V3 Factory for failed transactions, we would need
the contract address, the number of failed transactions that are allowed to occur before an alert is
generated, and a type and severity for the alert:

```
  "failedTransactions": {
    "UniswapV3Factory": {
      "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      "transactionFailuresLimit": 2,
      "type": "Info",
      "severity": "Medium"
    }
  }
```

Note that any unused entries in the configuration file must be deleted for the agent to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the agent.

8. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the `name` and `description` entries in the `package.json` file to appropriately
reflect who is creating the agent and what the agent monitors.

9. Move files to have the following directory structure:

```
  transaction-failure-count/
    README.md
    Dockerfile
    forta.config.json
    package.json
    agent-config.json
    src/
      agent.js
```

10. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

11. Once the `agent-config.json` file is populated and all corresponding ABI files are in the correct locations
referred to in the `agent-config.json` file, the agent is complete.  Please test the agent against transactions
that contain events that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.  Although not provided here, please create tests that will verify the functionality of
the agent code for positive cases, negative cases, and edge cases (e.g. when errors occur).

12. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation.
