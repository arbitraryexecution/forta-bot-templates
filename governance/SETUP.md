# Governance Events Agent Template

This agent monitors governance contracts that use the modular system of Governance contracts
available from OpenZepplin.  All of the possible emitted events are coded into the logic of the
agent, so that a developer only needs to update a few values in a data file to customize the
agent before deployment.

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

5. `governance` (required) - The Object corresponding to this key requires an entry for the contract
address under the `address` key and the appropriate name of the ABI file under the `abiFile` key.  All
of the supported ABI files are already present in the `./abi` subdirectory, so the only step necessary
is to type the correct name of the applicable ABI file.

6. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the name and description fields in the `package.json` file.

7. Move files to have the following directory structure:
```
  monitor-function-calls/
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
      test-utils.js
      utils.js
    abi/
      AppropriateGovernanceABIFile.json
```

10. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

11. Once the `agent-config.json` file is populated and the corresponding ABI file is in the correct location
referred to in the `agent-config.json` file, the agent is complete.  Please test the agent against transactions
that contain function calls that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.

12. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation:
  https://docs.forta.network/en/latest/deploying/

