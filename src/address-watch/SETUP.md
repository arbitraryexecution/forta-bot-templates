# Address Watch Template

This bot monitors blockchain transactions for those involving specific addresses, which may be either EOAs or contracts.
Alert type is always set to Suspicious and severity is set to Low. An existing bot of this type may be modified to add/remove/update
addresses in the bot configuration file.

## Bot Setup Walkthrough

1. The Object value for the `contractName1` key corresponds to addresses that we want to monitor.  Each
key in the Object is an address (either EOA or contract), and each value is another object with three fields:
  -`name`: the name of the contract or EOA that will be watched
  -`type`: the type of finding that will be generated when transactions involving this address are detected (see
  Forta SDK for `Finding` types)
  -`severity`: the severity of the finding that will be generated when transactions involving this address are
  detected (see Forta SDK for `Finding` severities)
