const BigNumber = require('bignumber.js');

const {
  ethers,
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
} = require('forta-agent');

const config = require('../agent-config.json');

const versionUtils = require('./version-utils');

const { abi: erc20Abi } = require('../abi/ERC20.json');
const erc20Interface = new ethers.utils.Interface(erc20Abi);

const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */

    data.alertFields = {
      developerAbbreviation: config.developerAbbreviation,
      protocolName: config.protocolName,
      protocolAbbreviation: config.protocolAbbreviation,
    };

    data.provider = getEthersProvider();

    // save the erc20 ABI and Transfer signature for later use
    data.erc20Abi = erc20Abi;
    const ftype = ethers.utils.FormatTypes.full;
    data.transferSignature = erc20Interface.getEvent('Transfer').format(ftype);

    data.previousBalances = {};

    // gnosis_safe specific configuration values
    data.gnosisSafe = config.contracts;

    data.contracts = Object.entries(data.gnosisSafe);
    data.contracts = await Promise.all(data.contracts.map(async ([name, entry]) => {
      let { address, version } = entry.gnosisSafe;
      address = address.toLowerCase()
      // get the current block number to retrieve all past Transfer events
      const blockNumber = await data.provider.getBlockNumber();

      // look up all Transfer events to this address
      const topics = erc20Interface.encodeFilterTopics('Transfer', [
        null,
        address,
      ]);

      const filter = {
        fromBlock: 0,
        toBlock: blockNumber,
        topics,
      };
      const rawLogs = await data.provider.getLogs(filter);
      // extract the token addresses from the Transfer events
      let tokenAddresses = rawLogs.map((rawLog) => rawLog.address.toLowerCase());

      // get rid of any duplicates
      tokenAddresses = [...new Set(tokenAddresses)];

      // create ethers contract objects for each token
      const tokenContracts = tokenAddresses.map((tokenAddress) => {
        const contract = new ethers.Contract(tokenAddress, erc20Abi, data.provider);
        return contract;
      });

      // load the appropriate abi
      // eslint-disable-next-line import/no-dynamic-require,global-require
      const { abi } = require(`../abi/${version}/gnosis_safe.json`);
      const iface = new ethers.utils.Interface(abi);
      const names = Object.keys(iface.events); // filter out only the events from the abi
      const eventSignatures = names.map((iName) => iface.getEvent(iName).format(ftype));

      const contract = {
        address,
        version,
        tokenContracts,
        eventSignatures,
        tokenAddresses,
      };
      return contract;
    }));
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      alertFields,
      transferSignature,
      erc20Abi,
      provider,
      contracts,
    } = data;

    const findings = [];

    // if any transfers occurred to or from this safe, store the token address and create an ethers
    // contract object for interactions in the handleBlock function
    const transferLogs = txEvent.filterLog(transferSignature);
    contracts.forEach((contract) => {
      const { address, tokenContracts, eventSignatures, version, tokenAddresses } = contract;
      transferLogs.forEach((log) => {
        if ((log.args.from.toLowerCase() === address.toLowerCase()) // if any transfer to or from
          || (log.args.to.toLowerCase() === address.toLowerCase())) {
          if ((tokenAddresses.indexOf(log.address.toLowerCase()) === -1)
            && (tokenAddresses.push(log.address.toLowerCase()))) {
            const tokenContract = new ethers.Contract(log.address, erc20Abi, provider);
            tokenContracts.push(tokenContract);
          }
        }
      });
      // now filter for any events emitted by the safe contract
      const logs = txEvent.filterLog(eventSignatures, address);
      logs.forEach((log) => {
        const { name, args } = log;
        const findingObject = versionUtils.getFindings(version, name, alertFields, address, args);
        if (findingObject) {
          findingObject.type = FindingType.Info;
          findingObject.severity = FindingSeverity.Info;
          findingObject.protocol = alertFields.protocolName;
          const finding = Finding.fromObject(findingObject);
          findings.push(finding);
        }
      });
    });
    return findings;
  };
}

function provideHandleBlock(data) {
  return async function handleBlock() {
    const findings = [];

    const {
      provider,
      alertFields,
      contracts,
      previousBalances,
    } = data;

    const {
      developerAbbreviation,
      protocolAbbreviation,
      protocolName,
    } = alertFields;

    contracts.forEach(async (contract) => {
      const { address, tokenContracts } = contract;
      // console.log("token contracts here", tokenContracts)
      const ethBalance = await provider.getBalance(address); // get eth balance of given contract
      const ethBalanceBN = new BigNumber(ethBalance.toString());
      // console.log("token contracts here", tokenContracts)

      // for every token transfer that's ever happened to this safe address, we created a new token contract for it
      const promises = tokenContracts.map(async (tokenContract) => {
        console.log("specific token contract here", tokenContract.balanceOf(address))
        const result = {};
        try {
          // get the balance of each token for this specific safe
          const tokenBalance = await tokenContract.balanceOf(address);
          // console.log("token balance here", tokenBalance)
          result[tokenContract.address.toLowerCase()] = new BigNumber(tokenBalance.toString());
        } catch {
          result[tokenContract.address.toLowerCase()] = new BigNumber(0);
        }
        return result;
      });

      // an array of objects
      const tokenBalancesArray = await Promise.all(promises);
      const tokenBalances = {};
      tokenBalancesArray.forEach((entry) => {
        Object.entries(entry).forEach(([key, value]) => {
          tokenBalances[key] = value;
        });
      });

      // check the current balances aginst the previous balances
      if (previousBalances) {
        Object.entries(previousBalances).forEach(([key, value]) => {
          if (key === 'Ether') {
            if (!value.eq(ethBalanceBN)) {
              // create finding
              findings.push(Finding.fromObject({
                name: `${protocolName} DAO Treasury MultiSig - Ether Balance Changed`,
                description: `Ether balance of ${address} changed by ${ethBalanceBN.minus(value).toString()}`,
                alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-ETH-BALANCE-CHANGE`,
                type: FindingType.Info,
                severity: FindingSeverity.Info,
                protocol: protocolName,
                metadata: {
                  previousBalance: value.toString(),
                  newBalance: ethBalanceBN.toString(),
                },
              }));
            }
          } else if (!value.eq(tokenBalances[key])) {
            // create finding
            findings.push(Finding.fromObject({
              name: `${protocolName} DAO Treasury MultiSig - Token Balance Changed`,
              description: `Token balance of ${address} changed by ${tokenBalances[key].minus(value).toString()}`,
              alertId: `${developerAbbreviation}-${protocolAbbreviation}-DAO-MULTISIG-TOKEN-BALANCE-CHANGE`,
              type: FindingType.Info,
              severity: FindingSeverity.Info,
              protocol: protocolName,
              metadata: {
                previousBalance: value.toString(),
                newBalance: tokenBalances[key].toString(),
                tokenAddress: key,
              },
            }));
          }
        });
      }

      // update the stored balances
      previousBalances.Ether = ethBalanceBN;
      Object.entries(tokenBalances).forEach(([key, value]) => {
        previousBalances[key] = value;
      });
    });

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
};
