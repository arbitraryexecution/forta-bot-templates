const BigNumber = require('bignumber.js');
const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');

const utils = require('../utils');
const versionUtils = require('./version-utils');

const validateConfig = (config) => {
  let ok = false;
  let errMsg = "";

  if (!utils.isFilledString(config.developerAbbreviation)) {
    errMsg = `developerAbbreviation required`;
    return { ok, errMsg };
  }
  if (!utils.isFilledString(config.protocolName)) {
    errMsg = `protocolName required`;
    return { ok, errMsg };
  }
  if (!utils.isFilledString(config.protocolAbbreviation)) {
    errMsg = `protocolAbbreviation required`;
    return { ok, errMsg };
  }

  const { contracts } = config;
  if (!utils.isObject(contracts) || utils.isEmptyObject(contracts)) {
    errMsg = `contracts key required`;
    return { ok, errMsg };
  }

  const gnosisSafe = Object.values(contracts);
  for (const safe of gnosisSafe) {
    if (!utils.isObject(safe) || utils.isEmptyObject(safe)) {
      errMsg = `gnosisSafe key required`;
      return { ok, errMsg };
    }

    const { version } = safe.gnosisSafe;
    const { address } = safe;

    // check that the address is a valid address
    if (!utils.isAddress(address)) {
      errMsg = `invalid address`;
      return { ok, errMsg };
    }

    // check that there is a corresponding file for the version indicated
    // eslint-disable-next-line import/no-dynamic-require,global-require
    const abi = utils.getInternalAbi(config.agentType, `${version}/gnosis-safe.json`);

    if (!utils.isObject(abi) || utils.isEmptyObject(abi)) {
      errMsg = `gnosis-safe abi required`;
      return { ok, errMsg };
    }
  }

  ok = true;
  return { ok, errMsg };
};

const initialize = async (config) => {
  let agentState = {...config};

  const { ok, errMsg } = validateConfig(config);
  if (!ok) {
    throw new Error(errMsg);
  }

  agentState.provider = getEthersProvider();

  // grab erc20 abi and create an interface
  const erc20Abi = utils.getInternalAbi(config.agentType, "ERC20.json");
  const erc20Interface = new ethers.utils.Interface(erc20Abi);

  // save the erc20 ABI and Transfer signature for later use
  agentState.erc20Abi = erc20Abi;
  const ftype = ethers.utils.FormatTypes.full;
  agentState.transferSignature = erc20Interface.getEvent('Transfer').format(ftype);

  // gnosis-safe specific configuration values
  agentState.gnosisSafe = config.contracts;

  const safeEntries = Object.entries(agentState.gnosisSafe);
  agentState.contracts = await Promise.all(safeEntries.map(async ([, entry]) => {
    const { version } = entry.gnosisSafe;
    const address = entry.address.toLowerCase();

    // get the current block number to retrieve all past Transfer events
    const blockNumber = await agentState.provider.getBlockNumber();

    // look up all Transfer events to this address
    const topics = erc20Interface.encodeFilterTopics('Transfer', [ null, address, ]);

    const filter = {
      fromBlock: 0,
      toBlock: blockNumber,
      topics,
    };
    const rawLogs = await agentState.provider.getLogs(filter);
    // extract the token addresses from the Transfer events
    let tokenAddresses = rawLogs.map((rawLog) => rawLog.address.toLowerCase());

    // get rid of any duplicates
    tokenAddresses = [...new Set(tokenAddresses)];

    // create ethers contract objects for each token
    const tokenContracts = tokenAddresses.map((tokenAddress) => {
      return new ethers.Contract(tokenAddress, erc20Abi, agentState.provider);
    });

    // load the appropriate abi
    // eslint-disable-next-line import/no-dynamic-require,global-require
    const abi = utils.getInternalAbi(config.agentType, `${version}/gnosis-safe.json`);
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

  return agentState;
};

const handleTransaction = async (agentState, txEvent) => {
  const findings = [];

  // if any transfers occurred to or from this safe, store the token address and create an ethers
  // contract object for interactions in the handleBlock function
  const transferLogs = txEvent.filterLog(agentState.transferSignature);
  agentState.contracts.forEach((contract) => {
    transferLogs.forEach((log) => {
      const addressLower = contract.address.toLowerCase();
      if (log.args.from.toLowerCase() !== addressLower && log.args.to.toLowerCase() !== addressLower) {
        return;
      }

      const logAddressLower = log.address.toLowerCase();
      const tokenAddresses = contract.tokenAddresses;
      if ((tokenAddresses.indexOf(logAddressLower) === -1) && tokenAddresses.push(logAddressLower)) {
        const tokenContract = new ethers.Contract(log.address, agentState.erc20Abi, agentState.provider);
        contract.tokenContracts.push(tokenContract);
      }
    });

    // filter for any events emitted by the safe contract
    const logs = txEvent.filterLog(contract.eventSignatures, contract.address);
    logs.forEach((log) => {
      const findingObject = versionUtils.getFindings(contract.version, log.name, agentState.protocolName, agentState.protocolAbbreviation, agentState.developerAbbreviation, contract.address, log.args);
      if (!findingObject) {
        return;
      }

      findingObject.type = FindingType.Info;
      findingObject.severity = FindingSeverity.Info;
      findingObject.protocol = agentState.protocolName;
      const finding = Finding.fromObject(findingObject);
      findings.push(finding);
    });
  });

  return findings;
};

const handleBlock = async (agentState) => {
  const {
    developerAbbreviation,
    protocolAbbreviation,
    protocolName,
  } = agentState;

  // find changes in eth balance and tokens for every gnosis safe address
  let totalFindings = await Promise.all(agentState.contracts.map(async (contract) => {
    const { address } = contract;
    const ethBalance = await agentState.provider.getBalance(address);
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
    contract.previousBalances.Ether = ethBalanceBN;
    Object.entries(tokenBalances).forEach(([key, value]) => {
      contract.previousBalances[key] = value;
    });

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
