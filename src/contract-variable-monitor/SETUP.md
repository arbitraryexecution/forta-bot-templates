# Contract Variable Monitor Agent Template

This agent monitors contract variables that contain numeric values for specified contract addresses.
Upper and lower percent change thresholds, number of data points to collect before checking for percent changes,
and alert type and severity are specified per variable per contract address.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.

1. Copy the `agent-config.json.example` file to a new file named `agent-config.json`.

2. `developerAbbreviation` (required) - Type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

3. `protocolName` (required) - Type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the SushiSwap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

4. `protocolAbbreviation` (required) - Type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"SushiSwap"` may be abbreviated `"SUSH"`, etc.

5.  `contracts` (required) - The Object value for this key corresponds to contracts that we want to monitor variable
values for.  Each key in the Object is a contract name that we can specify, where that name is simply a string that we use
as a label when referring to the contract (the string can be any valid string that we choose, it will not affect the
monitoring by the agent). The Object corresponding to each contract name requires an `address` key/value pair,
`abiFile` key/value pair, and a `variables` key. For the `variables` key, the corresponding value is an Object
containing the names of contract variables as keys. Note that each respective variable key must return
a numeric value from a contract. The value for each variable name is an Object containing:
    * type (required) - Forta Finding Type
    * severity (required) - Forta Finding Severity
    * upperThresholdPercent (optional) - Number as a change percentage that will trigger a finding if the monitored
      contract variable surpasses. Note if lowerThresholdPercent is not defined then this value is required.
    * lowerThresholdPercent (optional) - Number as a change percentage that will trigger a finding if the monitored
      contract variable is lower than. Note if upperThresholdPercent is not defined then this value is required.
    * numDataPoints (required) - Number of data points that need to be seen before calculating change
      percent. Note that if too high of a number is selected the agent may fail due to high memory usage.

For example, to monitor a UniswapV3Pool contract's liquidity, we would need the contract address, the
ABI saved locally as a JSON formatted file, the variable name (in this case liquidity) which will have
a corresponding getter function in the contract's ABI, a finding type, a finding severity, either an
upper threshold change percent or a lower threshold change percent, and the number of data points needed
before calculating change percent. The following shows what the contracts portion of the config file
would look like for this example:

``` json
  "contracts": {
    "UniswapV3Pool": {
      "address": "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
      "abiFile": "UniswapV3Pool.json",
      "variables": {
        "liquidity": {
          "type": "Info",
          "severity": "Low",
          "upperThresholdPercent": 15,
          "lowerThresholdPercent": 5,
          "numDataPoints": 10
        }
      }
    }
  }
```

Note: Any unused entries in the configuration file must be deleted for the agent to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the agent.

Note: If a contract is proxied by another contract, make sure that the value for the `address` key is the
address of the proxy contract.

6. We can obtain the contract ABI from one of several locations. The most accurate ABI will be the one
corresponding to the original contract code that was compiled and deployed onto the blockchain. This typically will
come from the Github repository of the protocol being monitored. For the Uniswap example provided thus far, the
deployed contracts are all present in the Uniswap Github repository here:
    https://github.com/Uniswap
If the aforementioned route is chosen, a solidity compiler will need to be used with the smart contract(s) to output
and store the corresponding ABI.

As an alternative, a protocol may publish its smart contract code on Etherscan, where users may view the code, ABI,
constructor arguments, etc. For these cases, simply navigate to `http://etherscan.io`, type the contract address
into the search bar, and check the `Contract` tab. If the code has been published, there should be a `Contract ABI`
section where the code can be exported in JSON format or copied to the clipboard. For the case of copying the ABI,
the result would look something like:

```json
  [
    {
      "constant": true,
      "inputs": [],
      "name": "liquidationIncentiveMantissa",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ]
```

We need to modify the ABI to make the copied/pasted result an entry in an Array corresponding to the key "abi"
in the file:

```json
{ 
  "abi": [
    {
      "constant": true,
      "inputs": [],
      "name": "liquidationIncentiveMantissa",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ]
}
```

The name of the JSON formatted file containing the ABI needs to have the same path as the value provided for
the `abiFile` key in the `agent-config.json` file.  This will allow the agent to load the ABI correctly
and call the requested getter functions corresponding to the variables listed in the config.

7. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the `name` and `description` entries in the `package.json` file to appropriately
reflect who is creating the agent and what the agent monitors.

8. Move files to have the following directory structure:

```
  contract-variable-monitor/
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
      test-utils.js
      utils.js
    abi/
      ContractABIFile1.json
      ContractABIFile2.json
      ...
      ContractABIFileN.json
```

9. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

10. Once the `agent-config.json` file is populated and all corresponding ABI files are in the correct locations
referred to in the `agent-config.json` file, the agent is complete. Please run the unit tests designed
to make sure all the required config values are defined and test the agent template logic with your
specific config.

11. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation.
