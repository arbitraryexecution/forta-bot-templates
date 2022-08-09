const fs = require("fs");
const { VAULTS } = require("@ichidao/ichi-sdk/dist/src/constants/vaults");

const vaultsToIgnore = [
  "boba",
  "home",
  "pol_wbtc",
  "pol_onebtc",
  "pol_usdc",
  "onegiv_giv",
];

let data = `
    {
      "developerAbbreviation": "MS99",
      "protocolName": "ICHI",
      "protocolAbbreviation": "ICHI",
      "gatherMode": "all",
      "bots": [
        {
          "botType": "monitor-events",
          "name": "bot_1",
          "contracts": {
    `;

Object.entries(VAULTS).forEach(([token, key1]) => {

  if (!vaultsToIgnore.includes(token, 0)) {
    
    Object.entries(key1).forEach(([chainId, vaultInfo]) => {
      data += `
      "${vaultInfo.vaultName}": {
        "address": "${vaultInfo.address}",
        "abiFile": "ICHIVault.json",
        "events": {
          "DepositMax": {
            "type": "Info",
            "severity": "Info"
          }
        }
      },
      `;
    });
  }
});

data += `
        }
      }
    ]
  }
`;

let current_dir = __dirname.replace("src", "");
current_dir = current_dir.replaceAll("\\", "/");
current_dir += "bot-config.json";

fs.writeFile(current_dir, data, (err) => {
  // In case of a error throw err.
  if (err) throw err;
});
