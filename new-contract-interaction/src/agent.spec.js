const axios = require('axios');

const {
    Finding, FindingType, FindingSeverity, createTransactionEvent, ethers,
} = require('forta-agent');
  
const agent = require('./agent');
  
// read the .env file and populate process.env with keys/values
require('dotenv').config();

// mock response from Etherscan API
// the 'timeStamp' field is the only one we need; all other fields have been removed
// only needs one tx record (result[0])
let mockTimestamp = 0;
const mockEtherscanResponse = {
  data: {
    status: 1,
    message: 'OK',
    result: [
      {
        timeStamp: mockTimestamp, // seconds
      },
    ],
  },
};

// mock the axios module for etherscan API calls
jest.mock('axios');
axios.get.mockResolvedValue(mockEtherscanResponse);

// mock response from ethers BaseProvider.getCode()
const mockGetCodeResponseEOA = '0x';
const mockGetCodeResponseContract = '0xabcd';

const mockEthersProvider = {
  getCode: jest.fn(),
  getTransactionCount: jest.fn(),
};

const filteredAddress = `0x3${'0'.repeat(39)}`;

config = {
    "developerAbbreviation": "AE",
    "protocolName": "TEST-PROTOCOL",
    "protocolAbbreviation": "TEST",
    "contracts": {
        "testContract": {
            "thresholdAgeDays": 7,
            "thresholdTransactionCount": 7,
            "address": `0x2${'0'.repeat(39)}`,
            "filteredAddresses": [
                filteredAddress,
            ],
            "findingType": "Suspicious",
            "findingSeverity": "Medium"
        }
    },
};
  
// check the configuration file to verify the values
describe('check agent configuration file', () => {
    describe('procotolName key required', () => {
        const { protocolName } = config;
        expect(typeof (protocolName)).toBe('string');
        expect(protocolName).not.toBe('');
    });

    describe('protocolAbbreviation key required', () => {
        const { protocolAbbreviation } = config;
        expect(typeof (protocolAbbreviation)).toBe('string');
        expect(protocolAbbreviation).not.toBe('');
    });

    describe('developerAbbreviation key required', () => {
        const { developerAbbreviation } = config;
        expect(typeof (developerAbbreviation)).toBe('string');
        expect(developerAbbreviation).not.toBe('');
    });

    describe('contracts key required', () => {
        const { contracts } = config;
        expect(typeof (contracts)).toBe('object');
        expect(contracts).not.toBe({});
    });

    describe('contracts key values must be valid', () => {
        const { contracts } = config;
        Object.keys(contracts).forEach((key) => {
            const { thresholdAgeDays, thresholdTransactionCount, address, filteredAddresses, findingType, findingSeverity } = contracts[key];

            // make sure value for thresholdAgeDays in config is a number
            expect(thresholdAgeDays).toEqual(expect.any(Number));

            // make sure value for threshold in config is a number
            expect(thresholdTransactionCount).toEqual(expect.any(Number));

            // check that the address is a valid address
            expect(ethers.utils.isHexString(address, 20)).toBe(true);

            // check that filteredAddresses is an array
            expect(Array.isArray(filteredAddresses)).toBe(true);

            // check type, this will fail if 'type' is not valid
            expect(Object.prototype.hasOwnProperty.call(FindingType, findingType)).toBe(true);

            // check severity, this will fail if 'severity' is not valid
            expect(Object.prototype.hasOwnProperty.call(FindingSeverity, findingSeverity)).toBe(true);
        });
    });
});

describe('mocked APIs should work properly', () => {
    describe('mock axios GET request', () => {
        it('should call axios.get and return a response', async () => {
        mockEtherscanResponse.data.result[0].timeStamp = 42;
        const response = await axios.get('https://...');
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(response.data.result[0].timeStamp).toEqual(42);
    
        // reset call count for next test
        axios.get.mockClear();
        expect(axios.get).toHaveBeenCalledTimes(0);
        });
    });
    
    describe('mock ethers getCode request', () => {
        it('should call getCode and return a response', async () => {
        mockEthersProvider.getCode.mockResolvedValue(mockGetCodeResponseEOA);
        const code = await mockEthersProvider.getCode();
        expect(code).toEqual('0x');
        });
    });

    describe('mock ethers getTransactionCount request', () => {
        it('should call getTransactionCount and return a response', async () => {
        mockEthersProvider.getTransactionCount.mockResolvedValue(10);
        const count = await mockEthersProvider.getTransactionCount();
        expect(count).toEqual(10);
        });
    });    
});    


describe('new contract interaction monitoring', () => {
    let initializeData = {};
    let handleTransaction = null;
  
    // pass in mockEthers as the provider for handleTransaction() to use
    beforeAll(() => {
        initializeData.provider = mockEthersProvider;

        initializeData.developerAbbreviation = config.developerAbbreviation;
        initializeData.protocolName = config.protocolName;
        initializeData.protocolAbbreviation = config.protocolAbbreviation;

        const contractNames = Object.keys(config.contracts);
        initializeData.contracts = contractNames.map((name) => {
            const { thresholdAgeDays, thresholdTransactionCount, address, filteredAddresses, findingType, findingSeverity } = config.contracts[name];
              
            const contract = {
              name,
              address,
              filteredAddresses,
              thresholdAgeDays,
              thresholdTransactionCount,
              findingType,
              findingSeverity
            };
      
            return contract;
        });

        handleTransaction = agent.provideHandleTransaction(
            initializeData
      );
    });
  
    // reset function call count after each test
    afterEach(() => {
      axios.get.mockClear();
      mockEthersProvider.getCode.mockClear();
      mockEthersProvider.getTransactionCount.mockClear();
      axios.get.mockResolvedValue(mockEtherscanResponse);
    });
  
    describe('handleTransaction', () => {
      it('should have an Etherscan API key', () => {
        expect(process.env.ETHERSCAN_API_KEY).not.toBe(undefined);
      });
  
      it('returns empty findings if the no contracts are invoked', async () => {
        const txEvent = createTransactionEvent({
          transaction: {
            to: '0x1',
          },
          addresses: {
            '0x1': true,
            '0x2': true,
          },
          block: { timestamp: Date.now() / 1000 },
        });
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
  
        // check assertions
        expect(axios.get).toHaveBeenCalledTimes(0);
        expect(findings).toStrictEqual([]);
      });
    
      it('returns empty findings if the getCode function throws an error', async () => {
        const transaction_address = '0x1';          
        const txEvent = createTransactionEvent({
          transaction: {
            to: config.contracts.testContract.address,
          },
          addresses: {
            [config.contracts.testContract.address]: true,
            [transaction_address]: true,
          },
          block: { timestamp: Date.now() / 1000 },
        });
  
        // intentionally setup the getCode function to throw an error
        mockEthersProvider.getCode.mockImplementation(async () => { throw new Error('FAILED'); });
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
  
        // check assertions
        expect(axios.get).toHaveBeenCalledTimes(0);
        expect(findings).toStrictEqual([]);
      });
  
      it('returns empty findings if the etherscan api call throws an error', async () => {
        const transaction_address = '0x1';
        const now = Date.now() / 1000;
  
        const txEvent = createTransactionEvent({
          transaction: {
            to: config.contracts.testContract.address,
          },
          addresses: {
            [config.contracts.testContract.address]: true,
            [transaction_address]: true,
          },
          block: { timestamp: now },
        });
  
        mockEthersProvider.getCode.mockResolvedValue(mockGetCodeResponseContract);
  
        mockTimestamp = now - 86400 * 1; // 1 day = 86400 seconds
        mockEtherscanResponse.data.result[0].timeStamp = mockTimestamp;
  
        // intentionally setup the axios 'GET' request to throw an error
        axios.get.mockImplementation(async () => { throw new Error('FAILED'); });
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
  
        // check assertions
        expect(axios.get).toHaveBeenCalledTimes(1); // expect 1 call for the test address
        expect(findings).toStrictEqual([]);
      });
  
      it('returns empty findings if the invocation is from an old contract', async () => {
        const transaction_address = '0x1';          
        const now = Date.now() / 1000;
        const txEvent = createTransactionEvent({
          transaction: {
            to: config.contracts.testContract.address,
          },
          addresses: {
            [config.contracts.testContract.address]: true,
            [transaction_address]: true,
          },
          block: { timestamp: now },
        });
  
        mockEthersProvider.getCode.mockResolvedValue(mockGetCodeResponseContract);
        mockTimestamp = now - 86400 * 7; // 1 day = 86400 seconds
        mockEtherscanResponse.data.result[0].timeStamp = mockTimestamp;
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
        const contractAge = agent.getContractAge(now, mockTimestamp);
  
        // check assertions
        expect(axios.get).toHaveBeenCalledTimes(1); // expect 1 call for the test address
        expect(contractAge).toEqual(7);
        expect(findings).toStrictEqual([]);
      });

      it('returns empty findings if the invocation is from a filtered address', async () => {
        const transaction_address = filteredAddress;          
        const now = Date.now() / 1000;
        const txEvent = createTransactionEvent({
          transaction: {
            to: config.contracts.testContract.address,
          },
          addresses: {
            [config.contracts.testContract.address]: true,
            [transaction_address]: true,
          },
          block: { timestamp: now },
        });
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
  
        // check assertions
        expect(findings).toStrictEqual([]);
      });      

      it('returns a finding if a new contract was involved in the transaction', async () => {
        const transaction_address = '0x1';
        const now = Date.now() / 1000;
  
        const txEvent = createTransactionEvent({
          transaction: {
            to: config.contracts.testContract.address,
          },
          addresses: {
            [config.contracts.testContract.address]: true,
            [transaction_address]: true,
          },
          block: { timestamp: now },
        });
  
        mockEthersProvider.getCode.mockResolvedValue(mockGetCodeResponseContract);
  
        mockTimestamp = now - 86400 * 1; // 1 day = 86400 seconds
        mockEtherscanResponse.data.result[0].timeStamp = mockTimestamp;
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
        const contractAge = agent.getContractAge(now, mockTimestamp);
  
        // check assertions
        expect(axios.get).toHaveBeenCalledTimes(1); // expect 1 call for the test address
        expect(contractAge).toEqual(1);

        let expectedFindings = [];
        initializeData.contracts.forEach((contract) => {
            const {
                name,
                address,
                findingType,
                findingSeverity
            } = contract;

            expectedFindings.push(agent.createContractInteractionAlert(
                name,
                address,
                transaction_address, 
                contractAge,
                findingType,
                findingSeverity,
                initializeData.protocolName,
                initializeData.protocolAbbreviation,
                initializeData.developerAbbreviation                
            ));
        });

        expect(findings).toStrictEqual(expectedFindings);
      });

      it('returns empty findings if the invocation is from an old EOA', async () => {
        const transaction_address = '0x1';          
        const now = Date.now() / 1000;
        const txEvent = createTransactionEvent({
          transaction: {
            to: config.contracts.testContract.address,
          },
          addresses: {
            [config.contracts.testContract.address]: true,
            [transaction_address]: true,
          },
          block: { timestamp: now },
        });
  
        mockEthersProvider.getCode.mockResolvedValue(mockGetCodeResponseEOA);
        mockEthersProvider.getTransactionCount.mockResolvedValue(10);
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
  
        // check assertions
        expect(findings).toStrictEqual([]);
      });

      it('returns a finding if a new EOA was involved in the transaction', async () => {
        const transaction_address = '0x1';                    
        const txEvent = createTransactionEvent({
          transaction: {
            to: config.contracts.testContract.address,
          },
          addresses: {
            [config.contracts.testContract.address]: true,
            [transaction_address]: true,
          },
          block: { timestamp: Date.now() / 1000 },
        });
  
        const transactionCount = 1;
    
        mockEthersProvider.getCode.mockResolvedValue(mockGetCodeResponseEOA);
        mockEthersProvider.getTransactionCount.mockResolvedValue(transactionCount);
  
        // run forta agent
        const findings = await handleTransaction(txEvent);
  
        // check assertions
        let expectedFindings = [];
        initializeData.contracts.forEach((contract) => {
            const {
                name,
                address,
                findingType,
                findingSeverity
            } = contract;

            expectedFindings.push(agent.createEOAInteractionAlert(
                name,
                address,
                transaction_address, 
                transactionCount,
                findingType,
                findingSeverity,
                initializeData.protocolName,
                initializeData.protocolAbbreviation,
                initializeData.developerAbbreviation                
            ));
        });

        expect(findings).toStrictEqual(expectedFindings);
      });      
    });
  });
