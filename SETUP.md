# Multiple Bot Template

## Bot Setup Walkthrough

The following steps will take you from a completely blank template to a functional bot.  The only file that
needs to be modified for this bot to operate correctly is the configuration file `bot-config.json`

1. Copy the `bot-config.json.example` file to a new file named `bot-config.json`.

2. For the `developerAbbreviation` key, type in your desired abbreviation to specify your name or your development
team name.  For example, Arbitrary Execution uses the abbreviation `"AE"` for its `developerAbbreviation` value.

3. For the `protocolName` key, type in the name of the protocol.  For example, for the Uniswap protocol you may
type in `"Uniswap"` or `"Uniswap V3"`, for the Sushi Swap protocol you may type in `"Sushi"` or `"SushiSwap"`, etc.

4. For the `protocolAbbreviation` key, type in an appropriate abbreviation for the value in `protocolName`.  For
example, `"Uniswap"` may be abbreviated `"UNI"` and `"Sushi Swap"` may be abbreviated `"SUSH"`, etc.

5. Check out the SETUP.md in each bot directory for details on configuring each bot you want to use.

6. Set up any abi files that your bots need in the following directory structure:
```
  abi/
    <bot_name>/
      <abi_file.json>
    <bot_name>/
      <abi_file.json>
```

6. Create a new README.md file to provide a description of your bot, using examples from the Forta Github
repository.  Additionally, update the `name` entry in `package.json` to match the values provided in the
`bot-config.json` file.

7. Move files to have the following directory structure:
  ```
  forta-bot-templates/
    Dockerfile
    README.md
    .eslintrc.js
    .gitignore
    forta.config.json
    package.json
    bot-config.json
    abi/
      <bot-name>/
        <abi-file.json>
    src/
      <template-name>/
        agent.js
        agent.spec.js
 ```

8. Install all related `npm` packages using `npm i`.  This will create a `package-lock.json` file alongside
package.json.

9. Once the `bot-config.json` file is populated the bot is complete.  Please test the bot against transactions
that contain events that should trigger the bot.  Please also test the bot against transactions that should
not trigger the bot.  An example test is provided here.  It includes a positive and negative case, but please also
consider edge cases that may arise in production.

10. After sufficient testing, the bot may be published and deployed using the steps outlined in the Forta SDK
documentation:
  https://docs.forta.network/en/latest/deploying/
