# Admininstrative/Governance Events Agent Template

This agent monitors blockchain transactions for specific events emitted from specific contract addresses.  Alert 
type and severity are specified per event per contract address.  An existing agent of this type may be modified 
to add/remove/update events and contracts in the agent configuration file.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.  The only file that
needs to be modified for this agent to operate correctly is the configuration file `agent-config.json`.

1. Open the `agent-config.json` file.

2. Navigate to `https://everest.link` to look up the Everest registry ID for a specific project.  For example,
typing `Uniswap` into the search bar (revealed when you click the magnifying glass at the top of the page),
returns a number of potential matches, one of which is the correct Uniswap entry.  The ID for that entry is
`0xa2e07f422b5d7cbbfca764e53b251484ecf945fa`.

3. Copy and paste the Everest registry ID into the `agent-config.json` file as the value for the key `everestId`.

4. For the `developerAbbreviation` key, type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

5. For the `protocolName` key, type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the Sushi Swap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

6. For the `protocolAbbreviation` key, type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"Sushi Swap"` may be abbreviated `"SUSH"`, etc.

7.  The Object value for the `adminEvents` key corresponds to contracts that we want to monitor events for.  Each
key in the Object is a contract name that we can specify, where that name is simply a string that we use as a label
when referring to the contract (the string can be any valid string that we choose, it will not affect the monitoring
by the agent).  The Object corresponding to each contract name requires an address key/value pair, abi file key/value
pair, and either an `events` key or a `proxy` key.  For the case of an `events` key, the corresponding value is an
Object containing the names of events as keys and Objects containing Finding types and severities.  For example, to
monitor the Uniswap GovernorBravo contract for emitted `NewAdmin` events, we would need the contract address, the ABI
saved locally as a JSON formatted file, the exact event name corresponding to what is listed in the ABI file, and a
type and severity for the alert:

```
  "adminEvents": {
    "GovernorBravo": {
      "address": "0x408ED6354d4973f66138C91495F2f2FCbd8724C3",
      "abiFile": "./abi/GovernorBravo.json",
      "events": {
        "NewAdmin": { "type": "Suspicious", "severity": "Medium" }
      }
    } 
  }
```

8. If a contract is a proxy for another contract, where events will be emitted as if they are coming from the proxy
instead of from the underlying implementation contract, the entry in the `agent-config.json` file may look like the
following:

```
  "adminEvents": {
    "TransparentUpgradableProxy": {
      "address": "0xEe6A57eC80ea46401049E92587E52f5Ec1c24785",
      "abiFile": "./abi/TransparentUpgradableProxy.json",
      "proxy": "NonfungibleTokenPositionDescriptor"
    },
    "NonfungibleTokenPositionDescriptor": {
      "address": "0x91ae842A5Ffd8d12023116943e72A606179294f3",
      "abiFile": "./abi/NonfungibleTokenPositionDescriptor.json",
      "events": {
        "UpdateTokenRatioPriority": { "type": "Info", "severity": "Info" }
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

9. We can obtain the contract ABI from one of several locations.  The most accurate ABI will be the one corresponding
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

```
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

10. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.  Also update the `name` and `description` entries in the `package.json` file to appropriately
reflect who is creating the agent and what the agent monitors.

11. Move files to have the following directory structure:
  admin-events/
    README.md
    Dockerfile
    forta.config.json
    package.json
    src/
      agent.js
      agent-config.json
      abi/
        ContractABIFile1.json
        ContractABIFile2.json
        ...
        ContractABIFileN.json

12. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

13. Once the `agent-config.json` file is populated and all corresponding ABI files are in the correct locations
referred to in the `agent-config.json` file, the agent is complete.  Please test the agent against transactions
that contain events that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.  Although not provided here, please create tests that will verify the functionality of
the agent code for positive cases, negative cases, and edge cases (e.g. when errors occur).

14. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK
documentation.
