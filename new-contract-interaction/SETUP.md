# New Contract Interaction Agent Template

This agent monitors blockchain transactions for new contracts interacting with specific contract
addresses. Alert type and severity are specified per contract.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.

1. Copy the `agent-config.json.example` file to a new file named `agent-config.json`.

2. `developerAbbreviation` (required) - Type in your desired abbreviation to specify your name or
your development team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its
`developerAbbreviation` value.

3. `protocolName` (required) - Type in the name of the protocol.  For example, for the Uniswap
protocol you may type in `"Uniswap"` or `"Uniswap V3"`, for the Sushi Swap protocol you may type in
`"Sushi"` or `"SushiSwap"`, etc.

4. `protocolAbbreviation` (required) - Type in an appropriate abbreviation for the value in
`protocolName`.  For example, `"Uniswap"` may be abbreviated `"UNI"` and `"Sushi Swap"` may be
abbreviated `"SUSH"`, etc.

5. `contracts` (required) - The Object value for this key corresponds to contracts that we want to
monitor for interactions with new EOAs and/or contracts. Each key in the Object is a contract name
that we can specify, where that name is simply a string that we use as a label when referring to the 
contract (the string can be any valid string that we choose, it will not affect the monitoring by the
agent). The corresponding value for the contract name is an Object containing:
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

Note that any unused entries in the configuration file must be deleted for the agent to work.  The
original version of the configuration file contains several placeholders to show the structure of
the file, but these are not valid entries for running the agent.

6. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the name and description fields in the `package.json` file.

7. Move files to have the following directory structure:
```
  new-contract-interaction/
    README.md
    SETUP.md
    COPYING
    LICENSE
    Dockerfile
    forta.config.json
    package.json
    agent-config.json
    src/
      agent.js
      agent.spec.js
```

8. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

9. Once the `agent-config.json` file is populated the agent is complete.  Please test the agent against transactions that contain new EOA and/or contract interactions that should trigger the agent.  Please also test the agent against transactions that should not trigger the agent.

10. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation:
  https://docs.forta.network/en/latest/deploying/
