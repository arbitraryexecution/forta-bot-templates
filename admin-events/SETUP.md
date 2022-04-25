# Admininstrative/Governance Events Agent Template

This agent monitors blockchain transactions for specific events emitted from specific contract addresses.  Alert 
type and severity are specified per event per contract address.  An existing agent of this type may be modified 
to add/remove/update events and contracts in the agent configuration file.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.

1. Copy the `agent-config.json.example` file to a new file named `agent-config.json`.

2. `developerAbbreviation` (required) - Type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

3. `protocolName` (required) - Type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the SushiSwap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

4. `protocolAbbreviation` (required) - Type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"SushiSwap"` may be abbreviated `"SUSH"`, etc.

5.  `contracts` (required) - The Object value for this key corresponds to contracts that we want to monitor events
for.  Each key in the Object is a contract name that we can specify, where that name is simply a string that we use
as a label when referring to the contract (the string can be any valid string that we choose, it will not affect the
monitoring by the agent).  The Object corresponding to each contract name requires an address key/value pair, abi
file key/value pair, and an `events` key, `proxy` key, or both.  For the case of an `events` key, the corresponding
value is an Object containing the names of events as keys. The value for each event name is an Object containing:
    * type (required) - Forta Finding Type
    * severity (required) - Forta Finding Severity
    * expression (optional) - A string that can be evaluated as a condition check when an event is emitted.
    The format of the expression is `<argument_name> <operator> <value>` (delimited by spaces) where
    `argument_name` is the case-sensitive name of an argument, specified in the ABI, that is emitted as part of the event,
    `operator` is a standard operation such as: `>=, !==, <` (a full table on supported operators can be found in the
    [Expression Compatibility Table](#expression-compatibility-table)), and `value` is an address, string, or number.

Note: If no expression is provided, the agent will create an alert whenever the specified event is emitted.

For example, to monitor the Uniswap GovernorBravo contract for emitted `NewAdmin` events, we would need the contract
address, the ABI saved locally as a JSON formatted file, the exact event name corresponding to what is listed in the
ABI file, and a type and severity for the alert:

``` json
  "contracts": {
    "GovernorBravo": {
      "address": "0x408ED6354d4973f66138C91495F2f2FCbd8724C3",
      "abiFile": "GovernorBravo.json",
      "events": {
        "NewAdmin": {
          "type": "Suspicious",
          "severity": "Medium"
        }
      }
    } 
  }
```

If we wanted to add an expression to check that the address of `newAdmin` emitted by the `NewAdmin` event is not the zero address,
the config would look like the following:

```json
  "contracts": {
    "GovernorBravo": {
      "address": "0x408ED6354d4973f66138C91495F2f2FCbd8724C3",
      "abiFile": "GovernorBravo.json",
      "events": {
        "NewAdmin": {
          "expression": "newAdmin !== 0x0000000000000000000000000000000000000000",
          "type": "Suspicious",
          "severity": "Medium"
        }
      }
    }
  }
```

Note that any unused entries in the configuration file must be deleted for the agent to work.  The original version
of the configuration file contains several placeholders to show the structure of the file, but these are not valid
entries for running the agent.

6. If a contract is a proxy for another contract, where events will be emitted as if they are coming from the proxy
instead of from the underlying implementation contract, the entry in the `agent-config.json` file may look like the
following:

```json
  "contracts": {
    "TransparentUpgradableProxy": {
      "address": "0xEe6A57eC80ea46401049E92587E52f5Ec1c24785",
      "abiFile": "TransparentUpgradableProxy.json",
      "proxy": "NonfungibleTokenPositionDescriptor"
    },
    "NonfungibleTokenPositionDescriptor": {
      "address": "0x91ae842A5Ffd8d12023116943e72A606179294f3",
      "abiFile": "NonfungibleTokenPositionDescriptor.json",
      "events": {
        "UpdateTokenRatioPriority": {
          "type": "Info",
          "severity": "Info"
        }
      }
    }
  }
```

In this example, all events are emitted by the address corresponding to the "TransparentUpgradableProxy" entry, but
the ABI for the implementation, containing the definition of those events, is specified by the JSON formatted file
corresponding to the "NonFungibleTokenPositionDescriptor" entry.  What is critical here is that the string corresponding
to the `proxy` key must be identical to one of the contract name keys in the `adminEvents` Object.  It is possible for
the proxy contract to emit its own events and events from the underlying implementation contract.  In those cases,
there may be an `"events"` key with corresponding Object value for the proxy contract as well.  Both sets of events
will be used by the agent when monitoring blockchain transactions.

7. We can obtain the contract ABI from one of several locations.  The most accurate ABI will be the one
corresponding to the original contract code that was compiled and deployed onto the blockchain.  This typically will
come from the Github repository of the protocol being monitored.  For the Uniswap example provided thus far, the
deployed contracts are all present in the Uniswap Github repository here:
    https://github.com/Uniswap
If the aforementioned route is chosen, a solidity compiler will need to be used with the smart contract(s) to output
and store the corresponding ABI.

As an alternative, a protocol may publish its smart contract code on Etherscan, where users may view the code, ABI,
constructor arguments, etc.  For these cases, simply navigate to `http://etherscan.io`, type the contract address
into the search bar, and check the `Contract` tab.  If the code has been published, there should be a `Contract ABI`
section where the code can be exported in JSON format or copied to the clipboard.  For the case of copying the ABI,
the result would look something like:

```json
  [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "oldAdmin",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "newAdmin",
          "type": "address"
        }
      ],
      "name": "NewAdmin",
      "type": "event"
    }
  ]
```

We need to modify the ABI to make the copied/pasted result an entry in an Array corresponding to the key "abi"
in the file:

```json
{ 
  "abi": [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "oldAdmin",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "newAdmin",
          "type": "address"
        }
      ],
      "name": "NewAdmin",
      "type": "event"
    }
  ]
}
```

The name of the JSON formatted file containing the ABI needs to have the same path as the value provided for
the `abiFile` key in the `agent-config.json` file.  This will allow the agent to load the ABI correctly and
parse transaction logs for events.

8. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the `name` and `description` entries in the `package.json` file to appropriately
reflect who is creating the agent and what the agent monitors.

9. Move files to have the following directory structure:

```
  admin-events/
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
    abi/
      ContractABIFile1.json
      ContractABIFile2.json
      ...
      ContractABIFileN.json
```

10. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

11. Once the `agent-config.json` file is populated and all corresponding ABI files are in the correct locations
referred to in the `agent-config.json` file, the agent is complete.  Please test the agent against transactions
that contain events that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.

12. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation.

## Appendix

### Expression Compatibility Table

|          | __Expression__ | ===  | !== | >= | <= | < | > |
| -------- | -------------- | ---- | --- | -- | -- | - | - |
| __Type__ |                |      |     |    |    |   |   |
| String   |                |  ✅  | ✅   |    |    |   |   |
| Boolean  |                |  ✅  | ✅   |    |    |   |   |
| Number   |                |  ✅  | ✅   | ✅ | ✅ | ✅ | ✅ |