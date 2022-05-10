# Governance Events Bot Template

This bot monitors governance contracts that use the modular system of Governance contracts
available from OpenZeppelin.  All of the possible emitted events are coded into the logic of the
bot, so that a developer only needs to update a few values in a data file to customize the
bot before deployment.

[OpenZeppelin Governance Contracts](https://docs.openzeppelin.com/contracts/4.x/api/governance)

## Bot Setup Walkthrough

The following steps will take you from a completely blank template to a functional bot.

1. `governance` (required) - The Object corresponding to this key requires an entry for the contract
address under the `address` key and the appropriate name of the ABI file under the `abiFile` key.  All
of the supported ABI files are already present in the `./abi` subdirectory, so the only step necessary
is to type the correct name of the applicable ABI file.
