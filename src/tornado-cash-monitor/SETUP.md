# Tornado Cash Template

This agent monitors blockchain transactions for those involving specified addresses and any address
that has previously interacted with a known Tornado Cash Proxy. An observation period (in blocks) to
watch addresses that have interacted with known Tornado Cash Proxies is configurable. Alert type and
severity is also configurable per contract.

## Agent Setup Walkthrough

The following steps will take you from a completely blank template to a functional agent.

1. `observationIntervalInBlocks` (required) - Type in a number that corresponds to the number of blocks
you would like the agent to monitor suspicious adresses for.

2. The Object value for the `contracts` key corresponds to addresses that we want to monitor. Each
key in the Object is an address name, and each value is another object with three fields:
    * address: the address of the contract or EOA that will be watched
    * type: Forta Finding Type
    * severity: Forta Finding Severity
