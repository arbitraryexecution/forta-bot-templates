# Initial overhaul

## Agents
- [X] account-balance
- [X] address-watch
- [X] admin-events
	- L19 -> L72 is choppy, need to better understand invariants
	  to know if this is as simple as it can be
- [X] gnosis-safe-multisig
	- require L61 probably going to bork
- [X] contract-variable-monitor

## Refactor Suggestions
- [ ] Distill out CreateAlert into a top-level util?
- [ ] Combine various utils into a single util file? (how similar are the utils?)
