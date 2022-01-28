const BigNumber = require('bignumber.js');
const { ethers } = require('forta-agent');
const utils = require('./utils');

function getObjectsFromAbi(abi, objectType) {
  const contractObjects = {};
  abi.forEach((entry) => {
    if (entry.type === objectType) {
      contractObjects[entry.name] = entry;
    }
  });
  return contractObjects;
}

function getEventFromConfig(abi, events) {
  let eventInConfig;
  let eventNotInConfig;
  let findingType;
  let findingSeverity;

  const eventsInConfig = Object.keys(events);
  const eventObjects = getObjectsFromAbi(abi, 'event');
  Object.keys(eventObjects).forEach((name) => {
    if ((eventNotInConfig !== undefined) && (eventInConfig !== undefined)) {
      return;
    }

    if ((eventsInConfig.indexOf(name) === -1) && (eventNotInConfig === undefined)) {
      eventNotInConfig = eventObjects[name];
    }

    if ((eventsInConfig.indexOf(name) !== -1) && (eventInConfig === undefined)) {
      eventInConfig = eventObjects[name];
      findingType = events[name].type;
      findingSeverity = events[name].severity;
    }
  });
  return {
    eventInConfig, eventNotInConfig, findingType, findingSeverity,
  };
}

function getExpressionOperand(operator, value, expectedResult) {
  // given a value, an operator, and a corresponding expected result, return a value that
  // meets the expected result
  let leftOperand;
  /* eslint-disable no-case-declarations */
  if (BigNumber.isBigNumber(value)) {
    switch (operator) {
      case '>=':
        if (expectedResult) {
          leftOperand = value.toString();
        } else {
          leftOperand = value.minus(1).toString();
        }
        break;
      case '<=':
        if (expectedResult) {
          leftOperand = value.toString();
        } else {
          leftOperand = value.plus(1).toString();
        }
        break;
      case '===':
        if (expectedResult) {
          leftOperand = value.toString();
        } else {
          leftOperand = value.minus(1).toString();
        }
        break;
      case '>':
      case '!==':
        if (expectedResult) {
          leftOperand = value.plus(1).toString();
        } else {
          leftOperand = value.toString();
        }
        break;
      case '<':
        if (expectedResult) {
          leftOperand = value.minus(1).toString();
        } else {
          leftOperand = value.plus(1).toString();
        }
        break;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  } else if (ethers.utils.isHexString(value)) {
    switch (operator) {
      case '===':
        if (expectedResult) {
          leftOperand = value;
        } else {
          leftOperand = ethers.constants.AddressZero;
        }
        break;
      case '!==':
        if (expectedResult) {
          leftOperand = ethers.constants.AddressZero;
        } else {
          leftOperand = value;
        }
        break;
      default:
        throw new Error(`Unsupported operator ${operator} for hexString comparison`);
    }
  } else if (typeof (value) === 'string') {
    if (utils.isAddress(value)) {
      switch (operator) {
        case '===':
          if (expectedResult) {
            leftOperand = value;
          } else {
            let temp = ethers.BigNumber.from(value);
            if (temp.eq(0)) {
              temp = temp.add(1);
            } else {
              temp = temp.sub(1);
            }
            leftOperand = ethers.utils.hexZeroPad(temp.toHexString(), 20);
          }
          break;
        case '!==':
          if (expectedResult) {
            let temp = ethers.BigNumber.from(value);
            if (temp.eq(0)) {
              temp = temp.add(1);
            } else {
              temp = temp.sub(1);
            }
            leftOperand = ethers.utils.hexZeroPad(temp.toHexString(), 20);
          } else {
            leftOperand = value;
          }
          break;
        default:
          throw new Error(`Unsupported operator ${operator} for address comparison`);
      }
    }
  } else {
    throw new Error(`Unsupported variable type ${typeof (value)} for comparison`);
  }

  /* eslint-enable no-case-declarations */
  return leftOperand;
}

function createMockEventLogs(eventObject, iface, override = undefined) {
  const mockArgs = [];
  const mockTopics = [];
  const eventTypes = [];
  const defaultData = [];
  const abiCoder = ethers.utils.defaultAbiCoder;

  // push the topic hash of the event to mockTopics - this is the first item in a topics array
  const fragment = iface.getEvent(eventObject.name);
  mockTopics.push(iface.getEventTopic(fragment));

  eventObject.inputs.forEach((entry) => {
    let value;
    switch (entry.type) {
      case 'uint256':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = 0;
        }

        if (entry.indexed) {
          mockTopics.push(value);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        // do not overwrite reserved JS words!
        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'uint256[]':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = [1];
        }

        if (entry.indexed) {
          throw new Error('indexed uint256[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'address':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = ethers.constants.AddressZero;
        }

        if (entry.indexed) {
          mockTopics.push(value);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'address[]':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = [ethers.constants.AddressZero];
        }

        if (entry.indexed) {
          throw new Error('indexed address[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'bytes':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = '0xff';
        }

        if (entry.indexed) {
          mockTopics.push(value);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'bytes[]':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = ['0xff'];
        }

        if (entry.indexed) {
          throw new Error('indexed bytes[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'bytes32':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
        }

        if (entry.indexed) {
          mockTopics.push(value);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'bytes32[]':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = [0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF];
        }

        if (entry.indexed) {
          throw new Error('indexed bytes32[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'string':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = 'test';
        }

        if (entry.indexed) {
          mockTopics.push(value);
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'string[]':
        if (override && entry.name === override.name) {
          ({ value } = override);
        } else {
          value = ['test'];
        }

        if (entry.indexed) {
          throw new Error('indexed string[] array not supported');
        } else {
          eventTypes.push(entry.type);
          defaultData.push(value);
        }

        if (mockArgs[entry.name] == null) {
          mockArgs[entry.name] = value;
        }
        break;
      case 'tuple':
        throw new Error('tuple not supported yet');
      default:
        throw new Error('Type passed in is not supported');
    }
  });

  const data = abiCoder.encode(eventTypes, defaultData);
  return { mockArgs, mockTopics, data };
}

module.exports = {
  getObjectsFromAbi,
  getEventFromConfig,
  getExpressionOperand,
  createMockEventLogs,
};
