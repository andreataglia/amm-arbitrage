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
const pathAlgo = require("../contracts/arbitrage-saga/arbitragePathAlgorithm");
const { countReset } = require("console");

describe("ArbitrageSaga", () => {
  var buyForETHAmount = 1;
  var ammAggregator;
  var tokens;
  var AMMs;
  var arbitrageSaga;
  var feePercentage;
  var sender;
  var recipientPercentages;
  var recipentAddresses;

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
      //context.usdtTokenAddress,
      context.chainLinkTokenAddress,
      context.usdcTokenAddress,
      context.daiTokenAddress,
      //context.mkrTokenAddress,
      //context.balTokenAddress,
    ].map((it) => new web3.eth.Contract(context.IERC20ABI, it));

    await Promise.all(
      tokens.map((it) => buyForETH(it, buyForETHAmount, AMMs.uniswap.contract))
    );

    var ArbitrageSaga = await compile("arbitrage-saga/ArbitrageSaga.sol");

    feePercentage = web3.utils.toWei("0");

    sender = (await web3.eth.getAccounts())[0];

    recipentAddresses = [
      (await web3.eth.getAccounts())[1],
      (await web3.eth.getAccounts())[2],
    ];

    recipientPercentages = [web3.utils.toWei("0.5"), web3.utils.toWei("0.5")];
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
        await amm.contract.methods
          .byTokens([
            tokenIterator,
            swapPath[j] === utilities.voidEthereumAddress
              ? amm.ethereumAddress
              : swapPath[j],
          ])
          .call()
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
    let inputToken = isInputTokenEther
      ? utilities.voidEthereumAddress
      : randomTokenAddress([context.wethTokenAddress]);

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
    let balance = web3.utils.fromWei((await totalSum(sender))[inputToken]);
    const scaledBalance =
      balance < 1 ? parseInt(web3.utils.toWei(balance).toString()) : balance;
    const randomAmount = randomPlainAmount(
      100,
      Math.floor(scaledBalance / 2) / 101
    );
    return balance < 1
      ? Math.floor(randomAmount)
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
    operation = await encodeSingleOperation(
      inputToken,
      amount,
      swaps,
      minEarning,
      receivers,
      reciversPcg
    );
    return operation;
  }

  async function getOutputAmount(inputTokenAddress, inputAmount, swaps) {
    var IAMM = await compile("amm-aggregator/common/IAMM");
    var iteratorAmount = inputAmount;
    var iteratorToken = inputTokenAddress;
    for (var j = 0; j < swaps.length; j++) {
      const amm = new web3.eth.Contract(IAMM.abi, swaps[j].ammPlugin);
      const outputAmounts = await amm.methods
        .getSwapOutput(
          iteratorToken,
          iteratorAmount,
          swaps[j].liquidityPoolAddresses,
          swaps[j].swapPath
        )
        .call();
      iteratorAmount = outputAmounts[outputAmounts.length - 1];
      iteratorToken = swaps[j].swapPath[swaps[j].swapPath.length - 1];
    }
    return iteratorAmount;
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
        trial++;
        console.log("Trial: " + trial);
      }
    }
  }

  describe("Can execute single operation with random ERC20 input token", () => {
    let operation;
    let prevSenderBalance;
    let prevFirstRecipientBalance;
    let prevSecondRecipientBalance;
    let outputAmount;
    before(async () => {
      operation = await repeatUntilGood(
        encodeRandomSingleOperation,
        ...[
          1,
          false,
          [
            { amm: AMMs.uniswap, numberOfTokens: 1 },
            { amm: AMMs.sushiSwap, numberOfTokens: 1 },
          ],
          0,
          recipentAddresses,
          recipientPercentages,
        ]
      );
      console.log("Operation: ", JSON.stringify(operation, censor(operation)));
      prevSenderBalance = web3.utils.toBN(
        (await totalSum(sender))[operation.inputTokenAddress]
      );
      prevFirstRecipientBalance = web3.utils.toBN(
        (await totalSum(recipentAddresses[0]))[operation.inputTokenAddress]
      );
      prevSecondRecipientBalance = web3.utils.toBN(
        (await totalSum(recipentAddresses[1]))[operation.inputTokenAddress]
      );
      outputAmount = web3.utils.toBN(
        await getOutputAmount(
          operation.inputTokenAddress,
          operation.inputTokenAmount,
          operation.swaps
        )
      );
      const tokenInstance = new web3.eth.Contract(
        context.IERC20ABI,
        operation.inputTokenAddress
      );
      await tokenInstance.methods
        .approve(arbitrageSaga.options.address, operation.inputTokenAmount)
        .send(blockchainConnection.getSendingOptions());

      const transaction = await arbitrageSaga.methods
        .execute([operation])
        .send(blockchainConnection.getSendingOptions());
      console.log(
        "Transaction " +
          transaction.transactionHash +
          " with " +
          transaction.gasUsed +
          " of gas used"
      );
    });

    it("Should subtract input amount from sender", async () => {
      const actualSenderBalance = web3.utils.toBN(
        (await totalSum(sender))[operation.inputTokenAddress]
      );
      assert.equal(
        actualSenderBalance.toString(),
        prevSenderBalance
          .sub(web3.utils.toBN(operation.inputTokenAmount))
          .toString(),
        "Wrong sender balance"
      );
    });

    it("Should add arbitrage output to first receiver", async () => {
      const actualFirstRecipientBalance = web3.utils.toBN(
        (await totalSum(recipentAddresses[0]))[operation.inputTokenAddress]
      );
      assert.equal(
        actualFirstRecipientBalance.toString(),
        prevFirstRecipientBalance
          .add(outputAmount.div(web3.utils.toBN(2)))
          .toString(),
        "Wrong first recipient balance"
      );
    });
  });

  describe("Can execute single operation with ERC20 input token after optimal path calculation", () => {
    let operation;
    let prevSenderBalance;
    let prevFirstRecipientBalance;
    let IAMM;
    let algoResult;

    before(async () => {
      console.log(await totalSum(sender));
      IAMM = await compile("amm-aggregator/common/IAMM");
      const inputToken = randomTokenAddress();
      const balanceAmount = web3.utils.toBN(
        (await totalSum(sender))[inputToken]
      );
      const inputAmount =
        inputToken === context.usdcTokenAddress
          ? utilities.toDecimals(10, 6)
          : utilities.toDecimals(10, 18);
      console.log(inputAmount.toString());
      console.log(inputToken);
      algoResult = await pathAlgo.findBestArbitragePath(
        inputToken,
        inputAmount,
        3,
        tokens.map((contract) => contract.options.address)
      );
      console.log(algoResult);
      let swaps = [];
      for (let i = 0; i < algoResult.ammPlugin.length; i++) {
        swaps.push({
          amm: {
            address: algoResult.ammPlugin[i],
            contract: new web3.eth.Contract(IAMM.abi, algoResult.ammPlugin[i]),
          },
          swapPath: [algoResult.swapPath[i]],
        });
      }

      console.log(swaps);
      operation = await encodeSingleOperation(
        inputToken,
        inputAmount,
        swaps,
        0,
        [recipentAddresses[0]],
        [web3.utils.toWei("1")]
      );

      prevSenderBalance = web3.utils.toBN(
        (await totalSum(sender))[operation.inputTokenAddress]
      );
      prevFirstRecipientBalance = web3.utils.toBN(
        (await totalSum(recipentAddresses[0]))[operation.inputTokenAddress]
      );
      const tokenInstance = new web3.eth.Contract(
        context.IERC20ABI,
        operation.inputTokenAddress
      );
      await tokenInstance.methods
        .approve(arbitrageSaga.options.address, operation.inputTokenAmount)
        .send(blockchainConnection.getSendingOptions());

      const transaction = await arbitrageSaga.methods
        .execute([operation])
        .send(blockchainConnection.getSendingOptions());
      console.log(
        "Transaction " +
          transaction.transactionHash +
          " with " +
          transaction.gasUsed +
          " of gas used"
      );
    });
    it("Should subtract input amount from sender", async () => {
      const actualSenderBalance = web3.utils.toBN(
        (await totalSum(sender))[operation.inputTokenAddress]
      );
      assert.equal(
        actualSenderBalance.toString(),
        prevSenderBalance
          .sub(web3.utils.toBN(operation.inputTokenAmount))
          .toString(),
        "Wrong sender balance"
      );
    });
  });
  it("Single operation with input token Ether", async () => {
    const operation = await repeatUntilGood(
      encodeRandomSingleOperation,
      ...[
        3,
        true,
        [
          { amm: AMMs.uniswap, numberOfTokens: 2 },
          { amm: AMMs.sushiSwap, numberOfTokens: 1 },
          { amm: AMMs.mooniswap, numberOfTokens: 1 },
        ],
        0,
        recipentAddresses,
        recipientPercentages,
      ]
    );
    console.log("Result: ", JSON.stringify(operation, censor(operation)));
    var transaction = await arbitrageSaga.methods.execute([operation]).send(
      blockchainConnection.getSendingOptions({
        value: operation.inputTokenAmount,
      })
    );
    console.log(
      "Tranasction " +
        transaction.transactionHash +
        " with " +
        transaction.gasUsed +
        " of gas used"
    );
  });

  it("Batch operations with input tokens ERC20", async () => {
    const firstOperation = await repeatUntilGood(
      encodeRandomSingleOperation,
      ...[
        1,
        false,
        [
          { amm: AMMs.uniswap, numberOfTokens: 1 },
          { amm: AMMs.mooniswap, numberOfTokens: 1 },
        ],
        0,
        recipentAddresses,
        recipientPercentages,
      ]
    );
    console.log(
      "Result first operation: ",
      JSON.stringify(firstOperation, censor(firstOperation))
    );

    let tokenInstance = new web3.eth.Contract(
      context.IERC20ABI,
      firstOperation.inputTokenAddress
    );
    await tokenInstance.methods
      .approve(arbitrageSaga.options.address, firstOperation.inputTokenAmount)
      .send(blockchainConnection.getSendingOptions());

    const secondOperation = await repeatUntilGood(
      encodeRandomSingleOperation,
      ...[
        1,
        false,
        [
          { amm: AMMs.sushiSwap, numberOfTokens: 1 },
          { amm: AMMs.uniswap, numberOfTokens: 1 },
        ],
        0,
        recipentAddresses,
        recipientPercentages,
      ]
    );
    console.log(
      "Result second operation: ",
      JSON.stringify(secondOperation, censor(secondOperation))
    );

    tokenInstance = new web3.eth.Contract(
      context.IERC20ABI,
      secondOperation.inputTokenAddress
    );
    const approvalAmount =
      firstOperation.inputTokenAddress === secondOperation.inputTokenAddress
        ? web3.utils
            .toBN(firstOperation.inputTokenAmount)
            .add(web3.utils.toBN(secondOperation.inputTokenAmount))
        : secondOperation.inputTokenAddress;
    await tokenInstance.methods
      .approve(arbitrageSaga.options.address, approvalAmount)
      .send(blockchainConnection.getSendingOptions());

    const firstOutputAmount = web3.utils.toBN(
      await getOutputAmount(
        firstOperation.inputTokenAddress,
        firstOperation.inputTokenAmount,
        firstOperation.swaps
      )
    );
    const secondOutputAmount = web3.utils.toBN(
      await getOutputAmount(
        secondOperation.inputTokenAddress,
        secondOperation.inputTokenAmount,
        secondOperation.swaps
      )
    );

    const prevSenderBalance = [
      web3.utils.toBN(
        (await totalSum(sender))[firstOperation.inputTokenAddress]
      ),
      web3.utils.toBN(
        (await totalSum(sender))[secondOperation.inputTokenAddress]
      ),
    ];
    const prevFirstRecipientBalance = [
      web3.utils.toBN(
        (await totalSum(recipentAddresses[0]))[firstOperation.inputTokenAddress]
      ),
      web3.utils.toBN(
        (await totalSum(recipentAddresses[0]))[
          secondOperation.inputTokenAddress
        ]
      ),
    ];
    const prevSecondRecipientBalance = [
      web3.utils.toBN(
        (await totalSum(recipentAddresses[1]))[firstOperation.inputTokenAddress]
      ),
      web3.utils.toBN(
        (await totalSum(recipentAddresses[1]))[
          secondOperation.inputTokenAddress
        ]
      ),
    ];

    var transaction = await arbitrageSaga.methods
      .execute([firstOperation, secondOperation])
      .send(blockchainConnection.getSendingOptions({}));
    console.log(
      "Tranasction " +
        transaction.transactionHash +
        " with " +
        transaction.gasUsed +
        " of gas used"
    );

    const actualSenderBalance = [
      web3.utils.toBN(
        (await totalSum(sender))[firstOperation.inputTokenAddress]
      ),
      web3.utils.toBN(
        (await totalSum(sender))[secondOperation.inputTokenAddress]
      ),
    ];
    const actualFirstRecipientBalance = [
      web3.utils.toBN(
        (await totalSum(recipentAddresses[0]))[firstOperation.inputTokenAddress]
      ),
      web3.utils.toBN(
        (await totalSum(recipentAddresses[0]))[
          secondOperation.inputTokenAddress
        ]
      ),
    ];
    const actualSecondRecipientBalance = [
      web3.utils.toBN(
        (await totalSum(recipentAddresses[1]))[firstOperation.inputTokenAddress]
      ),
      web3.utils.toBN(
        (await totalSum(recipentAddresses[1]))[
          secondOperation.inputTokenAddress
        ]
      ),
    ];

    if (
      firstOperation.inputTokenAddress === secondOperation.inputTokenAddress
    ) {
      const firstSingleOutputAmount = firstOutputAmount
        .div(web3.utils.toBN(2))
        .add(secondOutputAmount.div(web3.utils.toBN(2)));
      const usedAmount = web3.utils
        .toBN(firstOperation.inputTokenAmount)
        .add(web3.utils.toBN(secondOperation.inputTokenAmount));
      assert.equal(
        actualSenderBalance[0].toString(),
        prevSenderBalance[0].sub(usedAmount).toString(),
        "Wrong sender balance"
      );
    } else {
      assert.equal(
        actualSenderBalance[0].toString(),
        prevSenderBalance[0]
          .sub(web3.utils.toBN(firstOperation.inputTokenAmount))
          .toString(),
        "Wrong sender balance"
      );
      assert.equal(
        actualSenderBalance[1].toString(),
        prevSenderBalance[1]
          .sub(web3.utils.toBN(secondOperation.inputTokenAmount))
          .toString(),
        "Wrong sender balance"
      );
      assert.equal(
        actualFirstRecipientBalance[0].toString(),
        prevFirstRecipientBalance[0]
          .add(firstOutputAmount.div(web3.utils.toBN(2)))
          .toString(),
        "Wrong first recipient balance"
      );
      assert.equal(
        actualSecondRecipientBalance[0].toString(),
        prevSecondRecipientBalance[0]
          .add(firstOutputAmount.sub(firstOutputAmount.div(web3.utils.toBN(2))))
          .toString(),
        "Wrong second recipient balance"
      );
    }
  });

  it("Batch operations with input tokens Ethers", async () => {
    const firstOperation = await repeatUntilGood(
      encodeRandomSingleOperation,
      ...[
        2,
        true,
        [
          { amm: AMMs.uniswap, numberOfTokens: 2 },
          { amm: AMMs.mooniswap, numberOfTokens: 1 },
        ],
        0,
        recipentAddresses,
        recipientPercentages,
      ]
    );
    console.log(
      "Result first operation: ",
      JSON.stringify(firstOperation, censor(firstOperation))
    );
    const secondOperation = await repeatUntilGood(
      encodeRandomSingleOperation,
      ...[
        2,
        true,
        [
          { amm: AMMs.sushiSwap, numberOfTokens: 1 },
          { amm: AMMs.uniswap, numberOfTokens: 2 },
        ],
        0,
        recipentAddresses,
        recipientPercentages,
      ]
    );
    console.log(
      "Result second operation: ",
      JSON.stringify(secondOperation, censor(secondOperation))
    );
    var transaction = await arbitrageSaga.methods
      .execute([firstOperation, secondOperation])
      .send(
        blockchainConnection.getSendingOptions({
          value: web3.utils
            .toBN(firstOperation.inputTokenAmount)
            .add(web3.utils.toBN(secondOperation.inputTokenAmount)),
        })
      );
    console.log(
      "Tranasction " +
        transaction.transactionHash +
        " with " +
        transaction.gasUsed +
        " of gas used"
    );
  });

  it("Batch operations with both ERC20 tokens and Ethers", async () => {
    const firstOperation = await repeatUntilGood(
      encodeRandomSingleOperation,
      ...[
        1,
        false,
        [
          { amm: AMMs.uniswap, numberOfTokens: 1 },
          { amm: AMMs.sushiSwap, numberOfTokens: 1 },
        ],
        0,
        recipentAddresses,
        recipientPercentages,
      ]
    );
    console.log(
      "Result first operation: ",
      JSON.stringify(firstOperation, censor(firstOperation))
    );
    let tokenInstance = new web3.eth.Contract(
      context.IERC20ABI,
      firstOperation.inputTokenAddress
    );
    await tokenInstance.methods
      .approve(arbitrageSaga.options.address, firstOperation.inputTokenAmount)
      .send(blockchainConnection.getSendingOptions());
    const secondOperation = await repeatUntilGood(
      encodeRandomSingleOperation,
      ...[
        2,
        true,
        [
          { amm: AMMs.mooniswap, numberOfTokens: 1 },
          { amm: AMMs.uniswap, numberOfTokens: 2 },
        ],
        0,
        recipentAddresses,
        recipientPercentages,
      ]
    );
    console.log(
      "Result second operation: ",
      JSON.stringify(secondOperation, censor(secondOperation))
    );
    var transaction = await arbitrageSaga.methods
      .execute([firstOperation, secondOperation])
      .send(
        blockchainConnection.getSendingOptions({
          value: secondOperation.inputTokenAmount,
        })
      );
    console.log(
      "Tranasction " +
        transaction.transactionHash +
        " with " +
        transaction.gasUsed +
        " of gas used"
    );
  });
});
