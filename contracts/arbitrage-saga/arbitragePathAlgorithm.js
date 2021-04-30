const Web3 = require("web3")
const web3 = new Web3("https://mainnet.infura.io/v3/2f9984ba930b4c1d97b16392b4b6342a")
const context = require("../../util/context.json");
const utilities = require("../../util/utilities");
const abis = require("../../data/abis.json");

// The mainnet address of the AMM Aggregator
// docs: https://docs.ethos.wiki/covenants/protocols/amm-aggregator/dapp-integration
const ammAggregatorAddress = "0x81391d117a03A6368005e447197739D06550D4CD";

// abi of AMM Aggregator
const AMMAggregator = abis.AMMAggregatorABI;
let ammAggregator;

// TODO: start by the token list, and retrieve the pools using byTokens (not for balancer where we need hard coded pools)
//Pool list example. Liquidity Pool addresses on uniswap and mooniswap. [0][0] = uni[USDC-ETH]. [0][1] = mooni[ETH-USDC]
// const poolPair = [["0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc", "0x61bb2fda13600c497272a8dd029313afdb125fd3"], ["0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852", "0xbeabef3fc02667d8bd3f702ae0bb2c4edb3640cc"], ["0xd3d2e2692501a5c9ca623199d38826e513033a17","0x798934cdcfae18764ef4819274687df3fb24b99b"], ["0xa478c2975ab1ea89e8196811f51a7b7ade33eb11", "0x75116bd1ab4b0065b44e1a4ea9b4180a171406ed"],["0xa2107fa5b38d9bbd2c461d6edf11b11a50f6b974","0x377d0c7ecf3f94968bcbf85de863282cae997b45"], ["0xc2adda861f89bbb333c90c492cb837741916a225", "0x3a5e247d1b931347ef6e75a11b28bc5bfb4f608e"],["0x31631b3dd6c697e574d6b886708cd44f5ccf258f", "0xae461ca67b15dc8dc81ce7615e0320da1a9ab8d5"]];
//uni[USDC-ETH], uni[eth-usdt], uni[uni-eth], uni[dai-eth], uni[link-eth], uni[mkr-eth], uni[aave-eth, mooni[dai-usdc], uni[dai-usdc], mooni[usdc-eth], mooni[eth-usdt], mooni[uni-eth], mooni[dai-eth], mooni[link-eth], mooni[eth-maker]


const BREADTH = 3;
// algorithm DEPTH
// const tokensList = [context.usdtTokenAddress, context.daiTokenAddress];
const tokensList = ['a', 'b', 'c'];

let initialTokenAddress;
let initialTokenAmount;


async function init(inputTokenAddress, inputTokenAmount){
    ammAggregator = new web3.eth.Contract(AMMAggregator, ammAggregatorAddress);
    initialTokenAddress = inputTokenAddress;
    initialTokenAmount = inputTokenAmount;
    const result = await findBestArbitragePathForInputToken(initialTokenAddress, initialTokenAmount, []);
    console.log(result);
}

// try out all possible arbitrage paths with with depth limited by the token list, and breadth limited by a fixed constant
// TODO: so far it only returns the amount of the arbitrage, but it should return the whole arbitrage swap data path.
async function findBestArbitragePathForInputToken(inputToken, inputTokenAmount, currentPath) {
    // algorithm reached an end. swap back to initial token
    if(currentPath.length === BREADTH - 1){
        const newPath = currentPath.concat(initialTokenAddress);
        return {
            outputAmount: calculateSampleSwapOutput(inputToken, inputTokenAmount, currentPath.pop()),
            path: newPath
        }
    }

    let results = [];
    
    for (let i = 0; i < tokensList.length; i++) {
        const nextTokenToSwap = tokensList[i];   
        if(nextTokenToSwap !== inputToken) {
            const newPath = currentPath.concat(inputToken);
            const newAmount = calculateSampleSwapOutput(inputToken, inputTokenAmount, nextTokenToSwap);
            results.push(await findBestArbitragePathForInputToken(nextTokenToSwap, newAmount, newPath));
        }
    }
    
    return results.reduce((a,b) => {
        return a.outputAmount > b.outputAmount ? a : b;
    })
}


function calculateSampleSwapOutput(inputTokenAddress, inputTokenAmount, outputTokenAddress) {
    if(outputTokenAddress === 'b') return inputTokenAmount * 0.9;
    if(outputTokenAddress === 'c') return inputTokenAmount * 1.1;
    if(outputTokenAddress === 'a') return inputTokenAmount * 0.8;
}


// returns the token output for that pool, for that AMM
// only single pairs calculation.
async function calculateSingleSwapOutput(inputTokenAddress, inputTokenAmount, outputTokenAddress){
    const uniswapv2AmmPlugin = await findAMMPluginByName("uniswapv2");
    const LPAddress = await fetchLPAddress([inputTokenAddress, outputTokenAddress], uniswapv2AmmPlugin);

    if(LPAddress !== utilities.voidEthereumAddress) {
        const swapData = await retrieveSwapData([inputTokenAddress, outputTokenAddress], uniswapv2AmmPlugin);
        // getSwapOutput: Pass a token address, the desired amount to swap, an array containing the LP addresses involved in the swap operation and an array representing the path the operation must follow, 
        // and retrieve an array containing the amount of tokens used during the swap operation, including the final token amount (in the last position) and the input token amount (in the first position).
        const swapResult = await uniswapv2AmmPlugin.methods.getSwapOutput(inputTokenAddress, inputTokenAmount, swapData.swapPools, swapData.swapTokens).call();
        // last position containsthe swap final token amount 
        return swapResult[swapResult.length - 1];
    }
    return -1;
}


// retrievs pools and tokens path to be used on a swap, given the tokens and the ammPLugin interested for swapping 
async function retrieveSwapData(tokens, amm) {
    var swapPools = [];
    var swapTokens = [];

    for(i = 1; i < tokens.length; i++) {
        swapTokens.push(tokens[i]);
        var couple = [
            tokens[i - 1],
            tokens[i]
        ]
        // var data = await amm.methods.byTokens(couple).call();
        var liquidityPoolToken = await fetchLPAddress(couple, amm);
        // how can this work??? data
        // var liquidityPoolToken = data[0];
        swapPools.push(liquidityPoolToken);
    }
    
    //Keep in mind that swapPools and swapTokens must have the same length (greater than or equal to 1) to represent all the swapping hops
    return {
        tokenAddress : tokens[0],
        swapPools,
        swapTokens
    }
}

// find LP address for the two given tokens and return its address
async function fetchLPAddress(tokens, ammPlugin) {
    // TODO: if the ammPlugin doesn't have uniqueLPs - i.e. balancer - hardcode them here and simply look them up.
    return (await ammPlugin.methods.byTokens(tokens).call())[2];
}

async function findAMMPluginByName(ammName){
    //Retrieve all AMM plugins
    var ammPluginAddresses = await ammAggregator.methods.amms().call();

    var ammPlugins = {};

    await Promise.all(ammPluginAddresses.map(async ammPluginAddress => {
        var contract = new web3.eth.Contract(abis.AMMABI, ammPluginAddress);
        var info = await contract.methods.info().call();
        ammPlugins[info[0]] = contract;
    }));

    return Object.entries(ammPlugins).filter(entry => entry[0].toLowerCase().indexOf(ammName) !== -1)[0][1];
}

// TODO: use utilities.toDecimals('10', '18'). need web3 injected first..
init('a', 1);