var assert = require("assert");
var utilities = require("../util/utilities");
var context = require("../util/context.json");
var compile = require("../util/compile");
var blockchainConnection = require("../util/blockchainConnection");
var dfoManager = require("../util/dfo");
var ethers = require("ethers");
var abi = new ethers.utils.AbiCoder();
var path = require("path");
var fs = require("fs");
var glob = require("glob");
const { TIMEOUT } = require("dns");

describe("ArbitrageSaga", () => {
  var buyForETHAmount = 5000;
  var ammAggregator;
  var tokens;
  var AMMs;
  var arbitrageSaga;
  var feePercentage;

  before(async () => {
    await blockchainConnection.init;

    var AMMAggregator = await compile(
      "amm-aggregator/aggregator/AMMAggregator"
    );

    ammAggregator = new web3.eth.Contract(
      AMMAggregator.abi,
      context.ammAggregatorAddress
    );

    AMMs = await getAMMS();

    tokens = [
      context.wethTokenAddress,
      context.usdtTokenAddress,
      context.chainLinkTokenAddress,
      context.usdcTokenAddress,
      context.daiTokenAddress,
      context.mkrTokenAddress,
      context.balTokenAddress,
    ].map((it) => new web3.eth.Contract(context.IERC20ABI, it));

    await Promise.all(
      tokens.map((it) => buyForETH(it, buyForETHAmount, AMMs.uniswap.contract))
    );

    var ArbitrageSaga = await compile("arbitrage-saga/ArbitrageSaga.sol");

    feePercentage = web3.utils.toWei("0.01");

    const doubleProxy = await ammAggregator.methods.doubleProxy().call();

    arbitrageSaga = await new web3.eth.Contract(ArbitrageSaga.abi)
      .deploy({
        data: ArbitrageSaga.bin,
        arguments: [doubleProxy, feePercentage],
      })
      .send(blockchainConnection.getSendingOptions());
  });

  async function getAMMS() {
    var IAMM = await compile("amm-aggregator/common/IAMM");

    var addresses = await ammAggregator.methods.amms().call();

    var gottenAMMS = {};

    for (var address of addresses) {
      var amm = {
        address,
        contract: new web3.eth.Contract(IAMM.abi, address),
      };
      var data = await amm.contract.methods.data().call();
      amm.ethereumAddress = data[0];
      amm.maxTokensPerLiquidityPool = parseInt(data[1]);
      amm.hasUniqueLiquidityPools = data[2];
      data = await amm.contract.methods.info().call();
      amm.name = data[0];
      amm.version = data[1];
      gottenAMMS[
        amm.name.substring(0, 1).toLowerCase() +
          amm.name.substring(1).split("V2").join("")
      ] = amm;

      amm.name.toLowerCase().indexOf("balancer") !== -1 &&
        (amm.doubleTokenLiquidityPoolAddress = web3.utils.toChecksumAddress(
          "0x8a649274e4d777ffc6851f13d23a86bbfa2f2fbf"
        ));
      amm.name.toLowerCase().indexOf("balancer") !== -1 &&
        (amm.multipleTokenLiquidityPoolAddress = web3.utils.toChecksumAddress(
          "0x9b208194acc0a8ccb2a8dcafeacfbb7dcc093f81"
        ));
      delete gottenAMMS.balancer;
    }

    return gottenAMMS;
  }

  async function buyForETH(token, valuePlain, ammPlugin) {
    var value = utilities.toDecimals(valuePlain.toString(), "18");
    if (token.options.address === context.wethTokenAddress) {
      return await web3.eth.sendTransaction(
        blockchainConnection.getSendingOptions({
          to: context.wethTokenAddress,
          value,
          data: web3.utils.sha3("deposit()").substring(0, 10),
        })
      );
    }
    ammPlugin = ammPlugin || amm;
    var ethereumAddress = (await ammPlugin.methods.data().call())[0];
    var liquidityPoolAddress = (
      await ammPlugin.methods
        .byTokens([ethereumAddress, token.options.address])
        .call()
    )[2];
    await ammPlugin.methods
      .swapLiquidity({
        amount: value,
        enterInETH: true,
        exitInETH: false,
        liquidityPoolAddresses: [liquidityPoolAddress],
        path: [token.options.address],
        inputToken: ethereumAddress,
        receiver: utilities.voidEthereumAddress,
      })
      .send(blockchainConnection.getSendingOptions({ value }));
  }

  async function tokenData(token, method) {
    try {
      return await token.methods[method]().call();
    } catch (e) {}
    var name;
    try {
      var to = token.options ? token.options.address : token;
      var raw = await web3.eth.call({
        to,
        data: web3.utils.sha3(`${method}()`).substring(0, 10),
      });
      name = web3.utils.toUtf8(raw);
    } catch (e) {
      name = "";
    }
    name = name.trim();
    if (name) {
      return name;
    }
    if (!token.options || !token.options.address) {
      return "ETH";
    }
  }

  async function tokenData(token, method) {
    try {
      return await token.methods[method]().call();
    } catch (e) {}
    var name;
    try {
      var to = token.options ? token.options.address : token;
      var raw = await web3.eth.call({
        to,
        data: web3.utils.sha3(`${method}()`).substring(0, 10),
      });
      name = web3.utils.toUtf8(raw);
    } catch (e) {
      name = "";
    }
    name = name.trim();
    if (name) {
      return name;
    }
    if (!token.options || !token.options.address) {
      return "ETH";
    }
  }

  function randomTokenAddress(notThese) {
    notThese = notThese || [];
    notThese = notThese instanceof Array ? notThese : [notThese];
    var tokenAddress;
    while (
      notThese.indexOf(
        (tokenAddress =
          tokens[Math.floor(Math.random() * tokens.length)].options.address)
      ) !== -1
    ) {}
    return tokenAddress;
  }

  function randomNumberOfTokenAddress(tokensNumber, tokenExcluded) {
    let tokenAddresses = [];
    if (tokenExcluded === utilities.voidEthereumAddress) {
      tokenExcluded = context.wethTokenAddress;
    }
    while (tokenAddresses.length < tokensNumber) {
      const generatedAddress = randomTokenAddress();
      if (
        !tokenAddresses.includes(generatedAddress) &&
        generatedAddress !== tokenExcluded
      ) {
        tokenAddresses.push(generatedAddress);
      }
    }
    return tokenAddresses;
  }

  function randomPlainAmount(length, step) {
    var test = [];
    for (var i = 0; i < (length || 70); i++) {
      test.push((i == 0 ? 0 : test[i - 1]) + (step || 1));
    }
    return test[Math.floor(Math.random() * test.length)];
  }

  function assertstrictEqual(actual, expected, difference) {
    difference = difference || 0.0005;
    try {
      assert.strictEqual(actual, expected);
    } catch (e) {
      var diff = Math.abs(
        utilities.formatNumber(actual) - utilities.formatNumber(expected)
      );
      console.error(
        `Diff of ${diff} of ${difference}: ${actual} - ${expected}`
      );
      if (diff > difference) {
        throw e;
      }
    }
  }

  async function nothingInContracts(address) {
    var toCheck = [utilities.voidEthereumAddress];
    toCheck.push(...tokens.map((it) => it));
    for (var tkn of toCheck) {
      try {
        assert.strictEqual(
          tkn === utilities.voidEthereumAddress
            ? await web3.eth.getBalance(address)
            : await tkn.methods.balanceOf(address).call(),
          "0"
        );
      } catch (e) {
        console.error(
          `MONEY - ${await tokenData(tkn, "symbol")} - ${address} - ${
            e.message
          }`
        );
      }
    }
  }

  async function totalSum(address) {
    var data = {};
    var toCheck = [utilities.voidEthereumAddress];
    toCheck.push(...tokens.map((it) => it));
    for (var token of toCheck) {
      data[token.options ? token.options.address : token] =
        token === utilities.voidEthereumAddress
          ? await web3.eth.getBalance(address)
          : await token.methods.balanceOf(address).call();
    }
    return data;
  }

  async function encodeSingleOperation(
    inputToken,
    inputAmount,
    swaps = [],
    minEarning,
    receivers = [],
    reciversPcg = []
  ) {
    let encodedSwaps = [];
    let inputTokenIterator = inputToken;
    for (let i = 0; i < swaps.length; i++) {
      const encodedSwap = await encodeSwap(
        swaps[i].amm,
        inputTokenIterator,
        swaps[i].swapPath
      );
      inputTokenIterator = swaps[i].swapPath[swaps[i].swapPath.length - 1];
      encodedSwaps.push(encodedSwap);
    }
    console.log("PARAMS FINALS:  ");
    console.log(
      "-------------------------------------------------------------------"
    );
    console.log(inputToken);
    console.log(
      "-------------------------------------------------------------------"
    );
    console.log(inputAmount);
    console.log(
      "-------------------------------------------------------------------"
    );
    console.log(encodedSwaps);
    return {
      inputTokenAddress: inputToken,
      inputTokenAmount: inputAmount,
      swaps: encodedSwaps,
      minExpectedEarnings: minEarning,
      receivers: receivers,
      receiversPercentages: reciversPcg,
    };
  }

  async function encodeSwap(amm, inputToken, swapPath = []) {
    const enterInEth =
      amm.ethereumAddress === inputToken ||
      utilities.voidEthereumAddress === inputToken
        ? true
        : false;
    let tokenIterator =
      amm.ethereumAddress === inputToken ||
      utilities.voidEthereumAddress === inputToken
        ? amm.ethereumAddress
        : inputToken;
    let LPPools = [];
    for (let j = 0; j < swapPath.length; j++) {
      const LPPool = (
        await amm.contract.methods.byTokens([tokenIterator, swapPath[j]]).call()
      )[2];
      if (LPPool === utilities.voidEthereumAddress) {
        throw Error(
          "Liquidity pool does not exist for tokens: " +
            tokenIterator +
            " and " +
            swapPath[j] +
            " in AMM plugin: " +
            amm.address
        );
      }
      tokenIterator = swapPath[j];
      LPPools.push(LPPool);
    }
    return {
      ammPlugin: amm.address,
      liquidityPoolAddresses: LPPools,
      swapPath: swapPath,
      enterInEth: enterInEth,
      exitInEth:
        amm.ethereumAddress === swapPath[swapPath.length - 1] ||
        utilities.voidEthereumAddress === swapPath[swapPath.length - 1]
          ? true
          : false,
    };
  }

  function createRandomSwapPath(
    numberOfToken,
    isInputTokenEther = false,
    ammsData = []
  ) {
    const inputToken = isInputTokenEther
      ? utilities.voidEthereumAddress
      : randomTokenAddress();
    const randomAddresses = randomNumberOfTokenAddress(
      numberOfToken,
      inputToken
    );
    const tokenAddresses = [inputToken]
      .concat(randomAddresses)
      .concat([inputToken]);
    let sliceIterator = 1;
    let swaps = [];
    for (let j = 0; j < ammsData.length - 1; j++) {
      const singleSwap = {
        amm: ammsData[j].amm,
        swapPath: tokenAddresses.slice(
          sliceIterator,
          ammsData[j].numberOfTokens + sliceIterator
        ),
      };
      swaps.push(singleSwap);
      sliceIterator = ammsData[j].numberOfTokens + sliceIterator;
    }
    const lastSwap = {
      amm: ammsData[ammsData.length - 1].amm,
      swapPath: tokenAddresses
        .slice(-ammsData[ammsData.length - 1].numberOfTokens)
        .flat(),
    };
    swaps.push(lastSwap);
    return { inputToken, swaps };
  }

  function censor(censor) {
    var i = 0;
    return function (key, value) {
      if (
        i !== 0 &&
        typeof censor === "object" &&
        typeof value == "object" &&
        censor == value
      )
        return "[Circular]";
      if (i >= 29)
        // seems to be a harded maximum of 30 serialized objects?
        return "[Unknown]";
      ++i; // so we know we aren't using the original object anymore
      return value;
    };
  }

  async function generateRandomAmount(inputToken) {
    const account = (await web3.eth.getAccounts())[0];
    let balance = web3.utils.fromWei((await totalSum(account))[inputToken]);
    const scaledBalance =
      balance < 1 ? parseInt(web3.utils.toWei(balance).toString()) : balance;
    const randomAmount = randomPlainAmount(
      100,
      Math.floor(scaledBalance) / 100
    );
    return balance < 1
      ? randomAmount
      : web3.utils.toWei(randomAmount.toString());
  }

  async function encodeRandomSingleOperation(
    numberOfToken,
    isInputTokenEther = false,
    ammsData = [],
    minEarning,
    receivers = [],
    reciversPcg = []
  ) {
    const { inputToken, swaps } = createRandomSwapPath(
      numberOfToken,
      isInputTokenEther,
      ammsData
    );
    const amount = await generateRandomAmount(inputToken);
    await encodeSingleOperation(
      inputToken,
      amount,
      swaps,
      minEarning,
      receivers,
      reciversPcg
    );
  }

  function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function repeatUntilGood(functionToCheck, ...arguments) {
    let isGood = false;
    let trial = 0;
    while (isGood === false) {
      await timeout(10000);
      try {
        const response = await functionToCheck.apply(this, arguments);
        return response;
      } catch (e) {
        console.log(e);
        trial++;
        console.log("Trial: " + trial);
      }
    }
  }

  it("Single operation with input token Ether", async () => {
    try {
      const resp = await repeatUntilGood(
        encodeRandomSingleOperation,
        ...[
          3,
          true,
          [
            { amm: AMMs.uniswap, numberOfTokens: 2 },
            { amm: AMMs.sushiSwap, numberOfTokens: 1 },
            { amm: AMMs.mooniswap, numberOfTokens: 1 },
          ],
          "455666",
          account,
          ["1000000000"],
        ]
      );
      console.log("Censoring: ", resp);
      console.log("Result: ", JSON.stringify(resp, censor(resp)));
    } catch (e) {
      console.log(e);
    }
  });
});
