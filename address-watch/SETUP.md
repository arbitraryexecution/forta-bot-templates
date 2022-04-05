# Address Watch Template

This agent monitors blockchain transactions for those involving specific addresses, which may be either EOAs or contracts.
Alert type is always set to Suspicious and severity is set to Low. An existing agent of this type may be modified to add/remove/update
addresses in the agent configuration file.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.  The only file that
needs to be modified for this agent to operate correctly is the configuration file `agent-config.json`

1. Copy the `agent-config.json.example` file to a new file named `agent-config.json`.

2. For the `developerAbbreviation` key, type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

3. For the `protocolName` key, type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the Sushi Swap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

4. For the `protocolAbbreviation` key, type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"Sushi Swap"` may be abbreviated `"SUSH"`, etc.

5.  The Object value for the `contractName1` key corresponds to addresses that we want to monitor.  Each
key in the Object is an address (either EOA or contract), and each value is another object with three fields:
  -`name`: the name of the contract or EOA that will be watched
  -`type`: the type of finding that will be generated when transactions involving this address are detected (see
  Forta SDK for `Finding` types)
  -`severity`: the severity of the finding that will be generated when transactions involving this address are
  detected (see Forta SDK for `Finding` severities)

6. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Additionally, update the `name` entry in `package.json` to match the values provided in the 
`agent-config.json` file.

7. Move files to have the following directory structure:
  ```
  address-watch/
    Dockerfile
    README.md
    .eslintrc.js
    .gitignore
    forta.config.json
    package.json
    agent-config.json
    src/
      agent.js
      agent.spec.js
 ```

8. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

9. Once the `agent-config.json` file is populated the agent is complete.  Please test the agent against transactions
that contain events that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.  An example test is provided here.  It includes a positive and negative case, but please also
consider edge cases that may arise in production.

10. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK.
