# Function Calls Agent Template

This agent monitors blockchain transactions for specific function calls from specific contract
addresses, with the option to check the value of an argument against a specified value. Alert type
and severity are specified per function per contract address.

## Agent Setup Walkthrough

1. `contracts` (required) - The Object value for this key corresponds to contracts that we want to
monitor function calls for. Each key in the Object is a contract name that we can specify, where
that name is simply a string that we use as a label when referring to the contract (the string can
be any valid string that we choose, it will not affect the monitoring by the agent). The Object
corresponding to each contract name requires an address key/value pair, abi file key/value pair, and
a `functions` key.  The corresponding value for the `functions` key is an Object containing the
names of functions as keys. The value for each function name is an Object containing:
    * type (required) - Forta Finding Type
    * severity (required) - Forta Finding Severity
    * expression (optional) - A string that can be evaluated as a condition check when a function is
    called.  The format of the expression is `<argument_name> <operator> <value>` (delimited by
    spaces) where `argument_name` is the case-sensitive name of an input argument, specified in the
    ABI, that is provided as part trace data when the function is called, `operator` is a standard
    operation such as: `>=, !==, <` (a full table on supported operators can be found in the
    [Expression Compatibility Table](#expression-compatibility-table)), and `value` is an address,
    string, or number.

Note: If no expression is provided, the agent will create an alert whenever the specified function is
called.

For example, to monitor if `createPool` was called in the Uniswap V3 Factory contract to create a
pool with the WETH token as `tokenA`, we would need the contract address, the ABI saved
locally as a JSON formatted file, the exact function name corresponding to what is listed in the ABI
file, a type, a severity, and an expression that must be satisfied to create an alert:

```json
  "contracts": {
    "UniswapV3Factory": {
      "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      "abiFile": "factory.json",
      "functions": {
        "createPool": {
          "type": "Suspicious",
          "severity": "Medium",
          "expression": "tokenA === 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
        }
      }
    }
  }
```

Note that any unused entries in the configuration file must be deleted for the agent to work.  The
original version of the configuration file contains several placeholders to show the structure of
the file, but these are not valid entries for running the agent.

2. We can obtain the contract ABI from one of several locations.  The most accurate ABI will be the one corresponding
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

## Appendix

### Expression Compatibility Table

|          | __Expression__ | ===  | !== | >= | <= | < | > |
| -------- | -------------- | ---- | --- | -- | -- | - | - |
| __Type__ |                |      |     |    |    |   |   |
| String   |                |  ✅  | ✅   |    |    |   |   |
| Boolean  |                |  ✅  | ✅   |    |    |   |   |
| Number   |                |  ✅  | ✅   | ✅ | ✅ | ✅ | ✅ |
