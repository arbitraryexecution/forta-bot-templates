const BigNumber = require('bignumber.js');
const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');

const utils = require('../utils');
const versionUtils = require('./version-utils');

const validateConfig = (config) => {
  let ok = false;
  let errMsg = '';

  if (!utils.isFilledString(config.developerAbbreviation)) {
    errMsg = 'developerAbbreviation required';
    return { ok, errMsg };
  }
  if (!utils.isFilledString(config.protocolName)) {
    errMsg = 'protocolName required';
    return { ok, errMsg };
  }
  if (!utils.isFilledString(config.protocolAbbreviation)) {
    errMsg = 'protocolAbbreviation required';
    return { ok, errMsg };
  }

  const { contracts } = config;
  if (!utils.isObject(contracts) || utils.isEmptyObject(contracts)) {
    errMsg = 'contracts key required';
    return { ok, errMsg };
  }

  const gnosisSafe = Object.values(contracts);
  let safe;
  for (let i = 0; i < gnosisSafe.length; i += 1) {
    safe = gnosisSafe[i];
    if (!utils.isObject(safe) || utils.isEmptyObject(safe)) {
      errMsg = 'gnosisSafe key required';
      return { ok, errMsg };
    }

    const { address, gnosisSafe: { version } } = safe;

    // check that the address is a valid address
    if (!utils.isAddress(address)) {
      errMsg = 'invalid address';
      return { ok, errMsg };
    }

    // check that there is a corresponding file for the version indicated
    // eslint-disable-next-line import/no-dynamic-require,global-require
    const abi = utils.getInternalAbi(config.botType, `${version}/gnosis-safe.json`);

    if (!utils.isObject(abi) || utils.isEmptyObject(abi)) {
      errMsg = 'gnosis-safe abi required';
      return { ok, errMsg };
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config) => {
  const botState = { ...config };

  const { ok, errMsg } = validateConfig(config);
  if (!ok) {
    throw new Error(errMsg);
  }

  botState.provider = getEthersProvider();

  // grab erc20 abi and create an interface
  const erc20Abi = utils.getInternalAbi(config.botType, 'ERC20.json');
  const erc20Interface = new ethers.utils.Interface(erc20Abi);

  // save the erc20 ABI and Transfer signature for later use
  botState.erc20Abi = erc20Abi;
  const ftype = ethers.utils.FormatTypes.full;
  botState.transferSignature = erc20Interface.getEvent('Transfer').format(ftype);

  // gnosis-safe specific configuration values
  botState.gnosisSafe = config.contracts;

  const safeEntries = Object.entries(botState.gnosisSafe);
  botState.contracts = await Promise.all(safeEntries.map(async ([, entry]) => {
    const { version } = entry.gnosisSafe;
    const address = entry.address.toLowerCase();

    // get the current block number to retrieve all past Transfer events
    const blockNumber = await botState.provider.getBlockNumber();

    // look up all Transfer events to this address
    const topics = erc20Interface.encodeFilterTopics('Transfer', [null, address]);

    const filter = {
      fromBlock: 0,
      toBlock: blockNumber,
      topics,
    };
    const rawLogs = await botState.provider.getLogs(filter);
    // extract the token addresses from the Transfer events
    let tokenAddresses = rawLogs.map((rawLog) => rawLog.address.toLowerCase());

    // get rid of any duplicates
    tokenAddresses = [...new Set(tokenAddresses)];

    // create ethers contract objects for each token
    // eslint-disable-next-line max-len
    const tokenContracts = tokenAddresses.map((tokenAddress) => new ethers.Contract(tokenAddress, erc20Abi, botState.provider));

    // load the appropriate abi
    // eslint-disable-next-line import/no-dynamic-require,global-require
    const abi = utils.getInternalAbi(config.botType, `${version}/gnosis-safe.json`);
    const iface = new ethers.utils.Interface(abi);
    const names = Object.keys(iface.events); // filter out only the events from the abi
    const eventSignatures = names.map((iName) => iface.getEvent(iName).format(ftype));

    const previousBalances = {};
    const contract = {
      address,
      version,
      tokenContracts,
      eventSignatures,
      tokenAddresses,
      previousBalances,
    };

    return contract;
  }));

  return botState;
};

const handleTransaction = async (botState, txEvent) => {
  const findings = [];

  // if any transfers occurred to or from this safe, store the token address and create an ethers
  // contract object for interactions in the handleBlock function
  const transferLogs = txEvent.filterLog(botState.transferSignature);
  botState.contracts.forEach((contract) => {
    transferLogs.forEach((log) => {
      const addressLower = contract.address.toLowerCase();
      // eslint-disable-next-line max-len
      if (log.args.from.toLowerCase() !== addressLower && log.args.to.toLowerCase() !== addressLower) {
        return;
      }

      const logAddressLower = log.address.toLowerCase();
      const { tokenAddresses } = contract;
      // eslint-disable-next-line max-len
      if ((tokenAddresses.indexOf(logAddressLower) === -1) && tokenAddresses.push(logAddressLower)) {
        // eslint-disable-next-line max-len
        const tokenContract = new ethers.Contract(log.address, botState.erc20Abi, botState.provider);
        contract.tokenContracts.push(tokenContract);
      }
    });

    // filter for any events emitted by the safe contract
    const logs = txEvent.filterLog(contract.eventSignatures, contract.address);
    logs.forEach((log) => {
      const findingObject = versionUtils.getFindings(
        contract.version,
        log.name,
        botState.protocolName,
        botState.protocolAbbreviation,
        botState.developerAbbreviation,
        contract.address,
        log.args,
      );
      if (!findingObject) {
        return;
      }

      let addresses = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());
      addresses = addresses.filter((address) => address !== 'undefined');

      findingObject.type = FindingType.Info;
      findingObject.severity = FindingSeverity.Info;
      findingObject.protocol = botState.protocolName;
      findingObject.addresses = addresses;
      const finding = Finding.fromObject(findingObject);
      findings.push(finding);
    });
  });

  return findings;
};

const handleBlock = async (botState) => {
  const {
    developerAbbreviation,
    protocolAbbreviation,
    protocolName,
  } = botState;

  // find changes in eth balance and tokens for every gnosis safe address
  const totalFindings = await Promise.all(botState.contracts.map(async (contract) => {
    const { address } = contract;
    const ethBalance = await botState.provider.getBalance(address);
    const ethBalanceBN = new BigNumber(ethBalance.toString());

    // created new token contract for every token transfer that's ever happened to this address
    const promises = contract.tokenContracts.map(async (tokenContract) => {
      const result = {};
      try {
        // get the balance of each token for this specific safe
        const tokenBalance = await tokenContract.balanceOf(address);
        result[tokenContract.address.toLowerCase()] = new BigNumber(tokenBalance.toString());
      } catch {
        result[tokenContract.address.toLowerCase()] = new BigNumber(0);
      }

      return result;
    });

    const tokenBalances = {};
    const tokenBalancesArray = await Promise.all(promises);
    tokenBalancesArray.forEach((entry) => {
      Object.entries(entry).forEach(([key, value]) => {
        tokenBalances[key] = value;
      });
    });

    // check the current balances aginst the previous balances
    const findings = [];
    Object.entries(contract.previousBalances).forEach(([key, value]) => {
      if (key === 'Ether') {
        if (!value.eq(ethBalanceBN)) {
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

    // update the stored balances
    /* eslint-disable no-param-reassign */
    contract.previousBalances.Ether = ethBalanceBN;
    Object.entries(tokenBalances).forEach(([key, value]) => {
      contract.previousBalances[key] = value;
    });
    /* eslint-enable no-param-reassign */

    return findings;
  }));

  return totalFindings.flat();
};

module.exports = {
  validateConfig,
  initialize,
  handleTransaction,
  handleBlock,
};
