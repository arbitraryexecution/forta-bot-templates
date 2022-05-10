# Gnosis-Safe MultiSig Wallet Bot Template

This bot monitors a Gnosis-Safe multi-signature contract address for events emitted and any
changes in Ether or token balances.  All alert types and severities are set to Info by default.

## Bot Setup Walkthrough

1. `gnosisSafe` (required) - The Object value for this key corresponds to the contract that we want
to monitor for emitted events and balance changes.  There is a key for the contract address and
another that specifies the version of the Gnosis-Safe contract that is to be monitored.  The
supported versions are `v1.0.0`, `v1.1.1`, `v1.2.0`, and `v1.3.0`, where JSON files containing the
ABIs for those versions are located in the `./abi` directory and in their respective subdirectories.

For example, to monitor the Synthetix protocolDAO multisig contract for emitted events and balance
changes, the following content would be present in the `bot-config.json` file:

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

Note that any unused entries in the configuration file must be deleted for the bot to work.  The
original version of the configuration file contains several placeholders to show the structure of
the file, but these are not valid entries for running the bot.
