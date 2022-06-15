# Contract Variable Monitor Bot Template

This bot monitors contract variables that contain numeric values for specified contract addresses.
Upper and lower percent change thresholds, number of data points to collect before checking for percent changes,
and alert type and severity are specified per variable per contract address.

## Bot Setup Walkthrough

The following steps will take you from a completely blank template to a functional bot.

1. `contracts` (required) - The Object value for this key corresponds to contracts that we want to monitor variable
values for.  Each key in the Object is a contract name that we can specify, where that name is simply a string that we use
as a label when referring to the contract (the string can be any valid string that we choose, it will not affect the
monitoring by the bot). The Object corresponding to each contract name requires an `address` key/value pair,
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
      percent. Note that if too high of a number is selected the bot may fail due to high memory usage.

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

Note: Any unused entries in the configuration file must be deleted for the bot to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the bot.

Note: If a contract is proxied by another contract, make sure that the value for the `address` key is the
address of the proxy contract.

2. We can obtain the contract ABI from one of several locations. The most accurate ABI will be the one
corresponding to the original contract code that was compiled and deployed onto the blockchain. This typically will
come from the Github repository of the protocol being monitored. For the Uniswap example provided thus far, the
deployed contracts are all present in the Uniswap Github repository here:
    <https://github.com/Uniswap>
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
the `abiFile` key in the `bot-config.json` file.  This will allow the bot to load the ABI correctly
and call the requested getter functions corresponding to the variables listed in the config.
