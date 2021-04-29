const Web3 = require("web3")
const web3 = new Web3("https://mainnet.infura.io/v3/2f9984ba930b4c1d97b16392b4b6342a")
const context = require("../../util/context.json");
const utilities = require("../../util/utilities");
const abis = require("../../data/abis.json");

//The mainnet address of the AMM Aggregator
// docs: https://docs.ethos.wiki/covenants/protocols/amm-aggregator/dapp-integration
const ammAggregatorAddress = "0x81391d117a03A6368005e447197739D06550D4CD";

// TODO: get abi from data/abis.json
//abi of AMM Aggregator
const AMMAggregator = [{"inputs":[{"internalType":"address","name":"dFODoubleProxy","type":"address"},{"internalType":"address[]","name":"ammsToAdd","type":"address[]"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"amm","type":"address"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"uint256","name":"version","type":"uint256"}],"name":"AMM","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"","type":"address"}],"name":"NewLiquidityPoolAddress","type":"event"},{"inputs":[{"internalType":"address[]","name":"ammsToAdd","type":"address[]"}],"name":"add","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"bool","name":"amountIsLiquidityPool","type":"bool"},{"internalType":"bool","name":"involvingETH","type":"bool"},{"internalType":"address","name":"receiver","type":"address"}],"internalType":"struct LiquidityPoolData","name":"data","type":"tuple"}],"name":"addLiquidity","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"bool","name":"amountIsLiquidityPool","type":"bool"},{"internalType":"bool","name":"involvingETH","type":"bool"},{"internalType":"address","name":"receiver","type":"address"}],"internalType":"struct LiquidityPoolData[]","name":"data","type":"tuple[]"}],"name":"addLiquidityBatch","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"uint256[][]","name":"","type":"uint256[][]"},{"internalType":"address[][]","name":"","type":"address[][]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"amms","outputs":[{"internalType":"address[]","name":"returnData","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"}],"name":"byLiquidityPool","outputs":[{"internalType":"uint256","name":"liquidityPoolAmount","type":"uint256"},{"internalType":"uint256[]","name":"tokensAmounts","type":"uint256[]"},{"internalType":"address[]","name":"tokensAddresses","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"uint256","name":"liquidityPoolAmount","type":"uint256"}],"name":"byLiquidityPoolAmount","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"uint256","name":"numerator","type":"uint256"},{"internalType":"uint256","name":"denominator","type":"uint256"}],"name":"byPercentage","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"tokenAmount","type":"uint256"}],"name":"byTokenAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"liquidityPoolTokens","type":"address[]"}],"name":"byTokens","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address","name":"","type":"address"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"tokenAddresses","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"bool","name":"involvingETH","type":"bool"},{"internalType":"address","name":"receiver","type":"address"}],"name":"createLiquidityPoolAndAddLiquidity","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address","name":"","type":"address"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"data","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"}],"name":"data","outputs":[{"internalType":"address","name":"ethereumAddress","type":"address"},{"internalType":"uint256","name":"maxTokensPerLiquidityPool","type":"uint256"},{"internalType":"bool","name":"hasUniqueLiquidityPools","type":"bool"},{"internalType":"address","name":"amm","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"doubleProxy","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"}],"name":"findByLiquidityPool","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address[]","name":"","type":"address[]"},{"internalType":"address","name":"amm","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"tokenAmount","type":"uint256"},{"internalType":"address[]","name":"liquidityPoolAddresses","type":"address[]"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getSwapOutput","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"}],"name":"info","outputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"uint256","name":"version","type":"uint256"},{"internalType":"address","name":"amm","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"info","outputs":[{"internalType":"string","name":"","type":"string"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"remove","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"bool","name":"amountIsLiquidityPool","type":"bool"},{"internalType":"bool","name":"involvingETH","type":"bool"},{"internalType":"address","name":"receiver","type":"address"}],"internalType":"struct LiquidityPoolData","name":"data","type":"tuple"}],"name":"removeLiquidity","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"liquidityPoolAddress","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"bool","name":"amountIsLiquidityPool","type":"bool"},{"internalType":"bool","name":"involvingETH","type":"bool"},{"internalType":"address","name":"receiver","type":"address"}],"internalType":"struct LiquidityPoolData[]","name":"data","type":"tuple[]"}],"name":"removeLiquidityBatch","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"uint256[][]","name":"","type":"uint256[][]"},{"internalType":"address[][]","name":"","type":"address[][]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newDoubleProxy","type":"address"}],"name":"setDoubleProxy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"bool","name":"enterInETH","type":"bool"},{"internalType":"bool","name":"exitInETH","type":"bool"},{"internalType":"address[]","name":"liquidityPoolAddresses","type":"address[]"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"inputToken","type":"address"},
{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"receiver","type":"address"}],"internalType":"struct SwapData","name":"data","type":"tuple"}],"name":"swapLiquidity","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"bool","name":"enterInETH","type":"bool"},{"internalType":"bool","name":"exitInETH","type":"bool"},{"internalType":"address[]","name":"liquidityPoolAddresses","type":"address[]"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"inputToken","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"receiver","type":"address"}],"internalType":"struct SwapData[]","name":"data","type":"tuple[]"}],"name":"swapLiquidityBatch","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"payable","type":"function"}];

// TODO: start by the token list, and retrieve the pools using byTokens (not for balancer where we need hard coded pools)
//Pool list example. Liquidity Pool addresses on uniswap and mooniswap. [0][0] = uni[USDC-ETH]. [0][1] = mooni[ETH-USDC]
const poolPair = [["0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc", "0x61bb2fda13600c497272a8dd029313afdb125fd3"], ["0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852", "0xbeabef3fc02667d8bd3f702ae0bb2c4edb3640cc"], ["0xd3d2e2692501a5c9ca623199d38826e513033a17","0x798934cdcfae18764ef4819274687df3fb24b99b"], ["0xa478c2975ab1ea89e8196811f51a7b7ade33eb11", "0x75116bd1ab4b0065b44e1a4ea9b4180a171406ed"],["0xa2107fa5b38d9bbd2c461d6edf11b11a50f6b974","0x377d0c7ecf3f94968bcbf85de863282cae997b45"], ["0xc2adda861f89bbb333c90c492cb837741916a225", "0x3a5e247d1b931347ef6e75a11b28bc5bfb4f608e"],["0x31631b3dd6c697e574d6b886708cd44f5ccf258f", "0xae461ca67b15dc8dc81ce7615e0320da1a9ab8d5"]];
//uni[USDC-ETH], uni[eth-usdt], uni[uni-eth], uni[dai-eth], uni[link-eth], uni[mkr-eth], uni[aave-eth, mooni[dai-usdc], uni[dai-usdc], mooni[usdc-eth], mooni[eth-usdt], mooni[uni-eth], mooni[dai-eth], mooni[link-eth], mooni[eth-maker]

// dai, usdc
const tokenList = [context.daiTokenAddress, context.usdtTokenAddress]

let ammAggregator;

async function findBestArbitragePathForInputToken(inputTokenAddress, inputTokenAmount) {
    ammAggregator = new web3.eth.Contract(AMMAggregator, ammAggregatorAddress);    

    //index 0: The total supply of liquidity pool token
    //index 1: An array containing the reserves of each token in the pool
    //index 2: An array containing the token addresses that make up the pool
    //index 3: The address of the correct AMM plugin which served the previous data
    var liquidityPoolData1 = await ammAggregator.methods.findByLiquidityPool(poolPair[0][0]).call();
    
    let prova = await calculateSingleSwapOutput(context.usdtTokenAddress, inputTokenAmount, context.daiTokenAddress);
    console.log(liquidityPoolData1);

    var liquidityPoolData2 = await ammAggregator.methods.findByLiquidityPool(poolPair[0][1]).call();

    const maxBreadthSearch = 2;
    // try out all possible arbitrage paths with with depth limited by the token list, and breadth limited by a fixed constant

}
// returns the token output for that pool, for that AMM
// only single pairs calculation.
async function calculateSingleSwapOutput(inputTokenAddress, inputTokenAmount, outputTokenAddress){
    const uniswapv2AmmPlugin = await findAMMPluginByName("uniswapv2");
    const LPAddress = await fetchLPAddress(inputTokenAddress, outputTokenAddress, uniswapv2AmmPlugin);

    if(LPAddress !== utilities.voidEthereumAddress) {
        // getSwapOutput: Pass a token address, the desired amount to swap, an array containing the LP addresses involved in the swap operation and an array representing the path the operation must follow, 
        // and retrieve an array containing the amount of tokens used during the swap operation, including the final token amount (in the last position) and the input token amount (in the first position).
        const swapResult = await uniswapv2AmmPlugin.methods.getSwapOutput(inputTokenAddress, inputTokenAmount, [LPAddress], [outputTokenAddress]).call();
        // last position containsthe swap final token amount 
        return swapResult[swapResult.length - 1];
    }
    return -1;
}

// // find the LP address from the locally stored ones
// function getLocalLPAddress(tokenAddress0, tokenAddress1){

// }

// find LP address for the two given tokens and return its address
async function fetchLPAddress(tokenAddress0, tokenAddress1, ammPlugin) {
    // TODO: if the ammPlugin doesn't have uniqueLPs - i.e. balancer - hardcode them here and simply look them up.
    return (await ammPlugin.methods.byTokens([tokenAddress0, tokenAddress1]).call())[2];
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
findBestArbitragePathForInputToken('0x6b175474e89094c44da98b954eedeac495271d0f', '10000000000000000000');