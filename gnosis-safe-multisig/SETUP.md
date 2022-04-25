# Gnosis-Safe MultiSig Wallet Agent Template

This agent monitors a Gnosis-Safe multi-signature contract address for events emitted and any
changes in Ether or token balances.  All alert types and severities are set to Info by default.

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

5. `gnosisSafe` (required) - The Object value for this key corresponds to the contract that we want
to monitor for emitted events and balance changes.  There is a key for the contract address and
another that specifies the version of the Gnosis-Safe contract that is to be monitored.  The
supported versions are `v1.0.0`, `v1.1.1`, `v1.2.0`, and `v1.3.0`, where JSON files containing the
ABIs for those versions are located in the `./abi` directory and in their respective subdirectories.

For example, to monitor the Synthetix protocolDAO multisig contract for emitted events and balance
changes, the following content would be present in the `agent-config.json` file:

```json
{
  "developerAbbreviation": "AE",
  "protocolName": "Synthetix",
  "protocolAbbreviation": "SYN",
  "contracts": {
    "contractName1": {
      "address": "0xEb3107117FEAd7de89Cd14D463D340A2E6917769",
      "gnosisSafe": {
        "version": "v1.0.0"
      }
    }
  }
}
```


Note that any unused entries in the configuration file must be deleted for the agent to work.  The
original version of the configuration file contains several placeholders to show the structure of
the file, but these are not valid entries for running the agent.

6. Create a new README.md file to provide a description of your agent, using examples from the Forta
Github repository.  Also update the name and description fields in the `package.json` file.

7. Move files to have the following directory structure:
```
  gnosis-safe-multisig/
    README.md
    SETUP.md
    COPYING
    LICENSE
    Dockerfile
    .eslintrc.js
    .gitignore
    forta.config.json
    package.json
    agent-config.json
    src/
      agent.js
      agent.spec.js
      version-utils.js
    abi/
      v1.0.0/
        gnosis_safe.json
      v1.1.1/
        gnosis_safe.json
      v1.2.0/
        gnosis_safe.json
      v1.3.0/
        gnosis_safe.json
      ERC20.json
```

8. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file
alongside package.json.

9. Once the `agent-config.json` file is populated and all corresponding ABI files are in the correct
locations referred to in the `agent-config.json` file, the agent is complete.  Please test the agent
against transactions that contain emitted events that should trigger the agent.  Please also test
the agent against transactions that should not trigger the agent.

10. After sufficient testing, the agent may be published and deployed using the steps outlined in
the Forta SDK documentation:
  https://docs.forta.network/en/latest/deploying/
