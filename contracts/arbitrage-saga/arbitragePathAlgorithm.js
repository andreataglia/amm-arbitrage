const Web3 = require("web3")
const web3 = new Web3("https://mainnet.infura.io/v3/2f9984ba930b4c1d97b16392b4b6342a")
const context = require("../../util/context.json");
const utilities = require("../../util/utilities");
const abis = require("../../data/abis.json");

// TODO: temp web3 injection TO BE DELETED once branch merged back to main
global.web3 = web3;

// The mainnet address of the AMM Aggregator
// docs: https://docs.ethos.wiki/covenants/protocols/amm-aggregator/dapp-integration
const ammAggregatorAddress = "0x81391d117a03A6368005e447197739D06550D4CD";

// abi of AMM Aggregator
const AMMAggregator = abis.AMMAggregatorABI;
let ammAggregator;


const BREADTH = 3;
// algorithm DEPTH
const tokensList = [context.usdtTokenAddress, context.daiTokenAddress, context.usdcTokenAddress];

let initialTokenAddress;
let initialTokenAmount;

let amms = [];


async function init(inputTokenAddress, inputTokenAmount) {
    ammAggregator = new web3.eth.Contract(AMMAggregator, ammAggregatorAddress);
    initialTokenAddress = inputTokenAddress;
    initialTokenAmount = inputTokenAmount;

    // fetch amms infos
    const ammPluginAddresses = await ammAggregator.methods.amms().call();
    await Promise.all(ammPluginAddresses.map(async ammPluginAddress => {
        const contract = new web3.eth.Contract(abis.AMMABI, ammPluginAddress);
        const data = await contract.methods.data().call();
        const info = await contract.methods.info().call();
        amms.push({
            contract,
            name: info[0],
            version: info[1],
            ethereumAddress: data[0],
            maxTokensPerLiquidityPool: data[1], // this is ignored by the algorithm
            hasUniqueLiquidityPools: data[2]
        })
    }));


    const initialEmptySwapData = {
        ammPlugin: [],
        liquidityPoolAddresses: [],
        swapPath: [],
        outputAmount: '0'
    }
    const res = await findBestArbitragePathForInputToken(inputTokenAddress, inputTokenAmount, initialEmptySwapData);
    console.log(res);

    // struct ArbitrageSagaSwap {
    //     address ammPlugin;
    //     address[] liquidityPoolAddresses;
    //     address[] swapPath;
    
    //     bool enterInETH;
    //     bool exitInETH;
    // }
    
}

// try out all possible arbitrage paths with with depth limited by the token list, and breadth limited by a fixed constant
async function findBestArbitragePathForInputToken(inputToken, inputTokenAmount, swapData) {
    // algorithm reached an end. find an exit path by swapping back with initial token
    if(swapData.swapPath.length >= BREADTH - 1){
        const outputAmount = await calculateSwapOutput(inputToken, inputTokenAmount, initialTokenAddress);
        if(outputAmount){
            const newSwapData = swapData;
            newSwapData.outputAmount = outputAmount;
            newSwapData.swapPath = swapData.swapPath.concat(initialTokenAddress);
            return newSwapData;
        }
        return null;
    }

    let results = [];
    
    for (let i = 0; i < tokensList.length; i++) {
        const nextTokenToSwap = tokensList[i];   
        // TODO: find bets swap amount with all exchange before going ahead. nextTokenToSwap must be evalued for all pools
        const newAmount = await calculateSwapOutput(inputToken, inputTokenAmount, nextTokenToSwap);
        // if swapOuput doesn't return a truly value the swap just can't happen (for instance, same tokens). skip it 
        if(newAmount){
            const newSwapData = swapData;
            newSwapData.swapPath = swapData.swapPath.concat(inputToken);
            const nextArbitrageHop = await findBestArbitragePathForInputToken(nextTokenToSwap, newAmount, newSwapData);
            // if nextArbitrageHop doesn't find a suitable nextHop just ignore it
            if(nextArbitrageHop){
                results.push(nextArbitrageHop);
            }
        }
    }
    
    return results.reduce((a,b) => {
        return new web3.utils.BN(a.outputAmount).gt(new web3.utils.BN(b.outputAmount)) ? a : b;
    })
}


// returns the token output for that pool, for that AMM
// only single pairs calculation.
// checks the best amm where to swap that pair, that value is what is returned
async function calculateSwapOutput(inputTokenAddress, inputTokenAmount, outputTokenAddress) {
    if(inputTokenAddress === outputTokenAddress) return null;
    // TODO: need to find the path for all the available amms
    const uniswapv2AmmPlugin = amms.find(amm => amm.name === "UniswapV2");
    const LPAddress = await fetchLPAddress([inputTokenAddress, outputTokenAddress], uniswapv2AmmPlugin);

    if(LPAddress) {
        const swapData = await retrieveSwapData([inputTokenAddress, outputTokenAddress], uniswapv2AmmPlugin);
        
        // some tokens don't have 18 decimals... jerks. fix the amount to be with as much decimals as required by the input token
        const fixedInputAmount = await fixTokenDecimalsFrom18ToLower(inputTokenAddress, inputTokenAmount);

        // getSwapOutput: Pass a token address, the desired amount to swap, an array containing the LP addresses involved in the swap operation and an array representing the path the operation must follow, 
        // and retrieve an array containing the amount of tokens used during the swap operation, including the final token amount (in the last position) and the input token amount (in the first position).
        const swapResult = await uniswapv2AmmPlugin.contract.methods.getSwapOutput(inputTokenAddress, fixedInputAmount, swapData.swapPools, swapData.swapTokens).call();
        
        // some tokens don't have 18 decimals... jerks
        // last position of swapResult contains the swap final token amount
        const tokenOutput = await fixTokenDecimalsTo18(outputTokenAddress, swapResult[swapResult.length - 1]);

        return tokenOutput;
    }
    // the swap is just not happening
    return null;
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
    if(ammPlugin.hasUniqueLiquidityPools){
        try{
            return (await ammPlugin.contract.methods.byTokens(tokens).call())[2];
        }catch(err){
            return null;
        }
    }
    // TODO: if the ammPlugin doesn't have uniqueLPs - i.e. balancer - hardcode them here and simply look them up.
    return null;
}

// expecting the token amount to be the base contract one. returns that value fixed to 1e18
async function fixTokenDecimalsTo18(tokenAddress, tokenAmount) {
    const tokenContract = new web3.eth.Contract(abis.IERC20ABI, tokenAddress);
    const decimals = parseInt(await tokenContract.methods.decimals().call());
    if(decimals === 18) return tokenAmount;
    if(decimals < 18){
        const backToDecimals = utilities.fromDecimals(tokenAmount, decimals, true);
        return utilities.toDecimals(backToDecimals, 18)
    }
    throw Error(`decimals above 18 for token ${tokenAddress}`);
}

// usdc for instance expects the decimals to be 6. the function expects a 18 decimals input and throws back with the decimals needed by the token
async function fixTokenDecimalsFrom18ToLower(tokenAddress, tokenAmount) {
    const tokenContract = new web3.eth.Contract(abis.IERC20ABI, tokenAddress);
    let decimals = await tokenContract.methods.decimals().call();
    decimals = parseInt(decimals);
    if(decimals === 18) return tokenAmount;
    if(decimals < 18){
        const backToDecimals = utilities.fromDecimals(tokenAmount, 18, true);
        return utilities.toDecimals(backToDecimals, decimals)
    }
    throw Error(`decimals above 18 for token ${tokenAddress}`);
}


// breadth-first algorithm to find a viable arbitrage path
init(context.daiTokenAddress, utilities.toDecimals('10', '18'));