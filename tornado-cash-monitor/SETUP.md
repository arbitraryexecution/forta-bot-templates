# Address Watch Template

This agent monitors blockchain transactions for those involving specified addresses and any address
that has previously interacted with a known Tornado Cash Proxy. An observation period (in blocks) to
watch addresses that have interacted with known Tornado Cash Proxies is configurable. Alert type and
severity is also configurable per contract.

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

5. `observationIntervalInBlocks` (required) - Type in a number that corresponds to the number of blocks
you would like the agent to monitor suspicious adresses for.

6. The Object value for the `addressList` key corresponds to addresses that we want to monitor. Each
key in the Object is an address name, and each value is another object with three fields:
    * address: the address of the contract or EOA that will be watched
    * type: Forta Finding Type
    * severity: Forta Finding Severity

7. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository. Also update the name and description fields in the `package.json` file.

8. Move files to have the following directory structure:

```
  tornado-cash-monitor/
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
    abi/
      TornadoProxy.json
 ```

9. Install all related `npm` packages using `npm i`. This will create a `package-lock.json` file alongside
package.json.

10. Once the `agent-config.json` file is populated the agent is complete. Please test the agent against transactions
that contain events that should trigger the agent. Please also test the agent against transactions that should
not trigger the agent. A small test suite is provided and includes positive and negative cases, but please also
consider edge cases that may arise in production.

11. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK.
