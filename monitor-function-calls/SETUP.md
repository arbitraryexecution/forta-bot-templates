# Function Calls Agent Template

This agent monitors blockchain transactions for specific function calls from specific contract
addresses, with the option to check the value of an argument against a specified value. Alert type
and severity are specified per function per contract address.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.

1. Open the `agent-config.json` file.

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
monitor function calls for. Each key in the Object is a contract name that we can specify, where
that name is simply a string that we use as a label when referring to the contract (the string can
be any valid string that we choose, it will not affect the monitoring by the agent). The Object
corresponding to each contract name requires an address key/value pair, abi file key/value pair, and
a `functions` Object containing the names of functions as keys and Objects containing Finding types
and severities as values AND optionally an expression that must be satisfied for an alert to be
emitted.  For example, to monitor if `createPool` was called in a Uniswap V3 Factory contract, we
would need the contract address, the ABI saved locally as a JSON formatted file, the exact function
name corresponding to what is listed in the ABI file, and a type and severity for the alert:

```
  "contracts": {
    "UniswapV3Factory": {
      "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      "abiFile": "factory.json",
      "functions": {
        "createPool": { "type": "Suspicious", "severity": "Medium" }
      }
    }
  }
```

Note that any unused entries in the configuration file must be deleted for the agent to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the agent.

6. We can obtain the contract ABI from one of several locations.  The most accurate ABI will be the one corresponding
to the original contract code that was compiled and deployed onto the blockchain.  This typically will come from the
Github repository of the protocol being monitored.  For the Uniswap example provided thus far, the deployed contracts
are all present in the Uniswap Github repository here:
    https://github.com/Uniswap
If the aforementioned route is chosen, a solidity compiler will need to be used with the smart contract(s) to output
and store the corresponding ABI.

As an alternative, a protocol may publish its smart contract code on Etherscan, where users may view the code, ABI,
constructor arguments, etc.  For these cases, simply navigate to `http://etherscan.io`, type in the contract address
to the search bar, and check the `Contract` tab.  If the code has been published, there should be a `Contract ABI`
section where the code can be exported in JSON format or copied to the clipboard.  For the case of copying the ABI,
the result would look something like:

```
  [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenA",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenB",
          "type": "address"
        },
        {
          "internalType": "uint24",
          "name": "fee",
          "type": "uint24"
        }
      ],
      "name": "createPool",
      "outputs": [
        {
          "internalType": "address",
          "name": "pool",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
```

We need to modify the ABI to make the copied/pasted result an entry in an Array corresponding to the key "abi"
in the file:

```
{
  "abi":
  [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenA",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenB",
          "type": "address"
        },
        {
          "internalType": "uint24",
          "name": "fee",
          "type": "uint24"
        }
      ],
      "name": "createPool",
      "outputs": [
        {
          "internalType": "address",
          "name": "pool",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
}
```

The name of the JSON formatted file containing the ABI needs to have the same path as the value provided for
the `abiFile` key in the `agent-config.json` file.  This will allow the agent to load the ABI correctly and
parse transaction logs for function calls.

7. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the name and description fields in the `package.json` file.

8. Move files to have the following directory structure:
```
  monitor-function-calls/
    README.md
    Dockerfile
    forta.config.json
    package.json
    agent-config.json
    src/
      agent.js
      common.js
    abi/
      ContractABIFile1.json
      ContractABIFile2.json
      ...
      ContractABIFileN.json
```

9. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

10. Once the `agent-config.json` file is populated and all corresponding ABI files are in the correct locations
referred to in the `agent-config.json` file, the agent is complete.  Please test the agent against transactions
that contain function calls that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.  Although not provided here, please create tests that will verify the functionality of
the agent code for positive cases, negative cases, and edge cases (e.g. when errors occur).

11. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation:
  https://docs.forta.network/en/latest/deploying/
