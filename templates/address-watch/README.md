# Address Watch Template

This agent monitors blockchain transactions for those involving specific addresses, which may be either EOAs or contracts.
Alert type is always set to Suspicious and severity is set to Low. An existing agent of this type may be modified to add/remove/update
addresses in the agent configuration file.

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

7.  The Object value for the `addressList` key corresponds to addresses that we want to monitor.  Each
key in the Object is an address (either EOA or contract), and 

8. Create a new README.md file to provide a description of your agent, using examples from the Forta Github
repository.

9. Move files to have the following directory structure:
  address-watch/
    README.md
    forta.config.json
    package.json
    agent-config.json
    src/
      agent.js
      agent.spec.js

10. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

11. Once the `agent-config.json` file is populated the agent is complete.  Please test the agent against transactions
that contain events that should trigger the agent.  Please also test the agent against transactions that should
not trigger the agent.  An example test is provided here.  It includes a positive and negative case, but please also
consider edge cases that may arise in production.

12. After sufficient testing, the agent may be published and deployed using the steps outlined in the Forta SDK.
