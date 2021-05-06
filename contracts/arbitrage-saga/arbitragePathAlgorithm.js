/** The algorithm looks for the best arbitrage path given an input token and tokenAmount.
 *  The algorithm goes breadth first and simply brute forces all possible paths returning the one with the greatest output amount of token.
 *  
 * Limitations:
 * - if breadth input is X it will only output length-X paths, no matter if there's a better shorter path
 * - it only takes into account AMMs with maxTokensPerLiquidityPool = 2 and hasUniqueLiquidityPools = true
 * - the algo is pretty damn stupid and plenty of room for optimization
 */

const Web3 = require("web3")
const web3 = new Web3("https://mainnet.infura.io/v3/2f9984ba930b4c1d97b16392b4b6342a")
const context = require("../../util/context.json");
const utilities = require("../../util/utilities");
const abis = require("../../data/abis.json");

// put verbosity either 0 (only print output) or 1 (print anything)
const VERBOSITY = 1;

// TODO: temp web3 injection TO BE DELETED once branch merged back to main
global.web3 = web3;

// The mainnet address of the AMM Aggregator
// docs: https://docs.ethos.wiki/covenants/protocols/amm-aggregator/dapp-integration
const ammAggregatorAddress = "0x81391d117a03A6368005e447197739D06550D4CD";

// abi of AMM Aggregator
const AMMAggregator = abis.AMMAggregatorABI;
let ammAggregator;


let BREADTH;
let initialTokenAddress;
let initialTokenAmount;

// algorithm DEPTH : default list
let tokensList = [context.usdtTokenAddress, context.mkrTokenAddress, context.wethTokenAddress];

let amms = [];


/** Returns the best path possible given the set BREADTH. 
 * sample object returned:
 * {
 *  ammPlugin:(3) ['0xFC1665BD717dB247CDFB3a08b1d496D1588a6340', '0xFC1665BD717dB247CDFB3a08b1d496D1588a6340', '0xFC1665BD717dB247CDFB3a08b1d496D1588a6340']
    liquidityPoolAddresses:(3) ['0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11', '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852', '0xB20bd5D04BE54f870D5C0d3cA85d82b34B836405']
    swapPath:(3) ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0xdAC17F958D2ee523a2206206994597C13D831ec7', '0x6b175474e89094c44da98b954eedeac495271d0f']
    outputAmount:'9925268410941960287'
 * }
 * */
async function init(inputTokenAddress, inputTokenAmount, breadth, tokensDepth) {
    console.log('arbitrage path algorithm started computing...')
    ammAggregator = new web3.eth.Contract(AMMAggregator, ammAggregatorAddress);
    initialTokenAddress = inputTokenAddress;
    initialTokenAmount = inputTokenAmount;
    BREADTH = breadth;
    tokensList = tokensDepth;

    if(!tokensList.includes(inputTokenAddress)){
        tokensList.push(inputTokenAddress);
    }

    // fetch amms infos
    const ammPluginAddresses = await ammAggregator.methods.amms().call();
    await Promise.all(ammPluginAddresses.map(async ammPluginAddress => {
        const contract = new web3.eth.Contract(abis.AMMABI, ammPluginAddress);
        const data = await contract.methods.data().call();
        const info = await contract.methods.info().call();
        const amm = {
            contract,
            name: info[0],
            version: info[1],
            ethereumAddress: data[0],
            maxTokensPerLiquidityPool: data[1],
            hasUniqueLiquidityPools: data[2]
        };
        if(amm.hasUniqueLiquidityPools && amm.maxTokensPerLiquidityPool === '2'){
            amms.push(amm);
        }
    }));


    const initialEmptySwapData = {
        ammPlugin: [],
        liquidityPoolAddresses: [],
        swapPath: [],
        outputAmount: '0'
    }
    const res = await findBestArbitragePathForInputToken(inputTokenAddress, inputTokenAmount, initialEmptySwapData);
    console.log(res);
    
    return res;
}

// try out all possible arbitrage paths with with depth limited by the token list, and breadth limited by a fixed constant
async function findBestArbitragePathForInputToken(inputToken, inputTokenAmount, swapData) {
    // algorithm reached an end. The path becomes viable as we exit into the same token as the output
    if(inputToken === initialTokenAddress && swapData.swapPath.length > 0){
        if(VERBOSITY >= 1){
            console.log(`quitting with depth ${swapData.swapPath.length} and output ${inputTokenAmount}`);
        }
        swapData.outputAmount = inputTokenAmount;
        swapData.swapPath = swapData.swapPath;
        return swapData;
    }

    let results = [];
    
    for (let i = 0; i < tokensList.length; i++) {
        const nextTokenToSwap = tokensList[i];
        // if we are at the last hop, the only valid action is swapping back to the initial token address
        if(swapData.swapPath.length >= BREADTH - 1 && nextTokenToSwap !== initialTokenAddress) {
            continue;
        }
        // TODO: find bets swap amount with all exchange before going ahead. nextTokenToSwap must be evalued for all pools
        const swapResult = await calculateSwapOutput(inputToken, inputTokenAmount, nextTokenToSwap);
        // if swapOuput doesn't return a truly value the swap just can't happen (for instance, same tokens). skip it 
        if(swapResult) {
            const newSwapData = {...swapData};
            newSwapData.swapPath = swapData.swapPath.concat(nextTokenToSwap);
            newSwapData.liquidityPoolAddresses = swapData.liquidityPoolAddresses.concat(swapResult.liquidityPoolAddress);
            newSwapData.ammPlugin = swapData.ammPlugin.concat(swapResult.ammPlugin);
            const nextArbitrageHop = await findBestArbitragePathForInputToken(nextTokenToSwap, swapResult.tokenOutput, newSwapData);
            // if nextArbitrageHop doesn't find a suitable nextHop just ignore it
            if(nextArbitrageHop){
                results.push(nextArbitrageHop);
            }
        }
    }
    if(results.length > 0){
        return results.reduce((a,b) => {
            return new web3.utils.BN(a.outputAmount).gt(new web3.utils.BN(b.outputAmount)) ? a : b;
        })
    }
    return null;
    
}


// returns the token output for that pool, for that AMM
// only single pairs calculation.
async function calculateSwapOutput(inputTokenAddress, inputTokenAmount, outputTokenAddress) {
    if(inputTokenAddress === outputTokenAddress) return null;
    
    let bestResult = null;
    for (let i = 0; i < amms.length; i++) {
        try {
            const amm = amms[i];
            const LPAddress = await fetchLPAddress([inputTokenAddress, outputTokenAddress], amm);
            if(LPAddress) {
                const swapData = await retrieveSwapData([inputTokenAddress, outputTokenAddress], amm);
                    
                // some tokens don't have 18 decimals... jerks. fix the amount to be with as much decimals as required by the input token
                const fixedInputAmount = await fixTokenDecimalsFrom18ToLower(inputTokenAddress, inputTokenAmount);
            
                // getSwapOutput: Pass a token address, the desired amount to swap, an array containing the LP addresses involved in the swap operation and an array representing the path the operation must follow, 
                // and retrieve an array containing the amount of tokens used during the swap operation, including the final token amount (in the last position) and the input token amount (in the first position).
                const swapResult = await amm.contract.methods.getSwapOutput(inputTokenAddress, fixedInputAmount, swapData.swapPools, swapData.swapTokens).call();
                    
                // some tokens don't have 18 decimals... jerks
                // last position of swapResult contains the swap final token amount
                const tokenOutput = await fixTokenDecimalsTo18(outputTokenAddress, swapResult[swapResult.length - 1]);
                    
                // update best amm result
                if(bestResult){
                    if(new web3.utils.BN(tokenOutput).gt(new web3.utils.BN(bestResult.tokenOutput))){
                        bestResult = {
                            tokenOutput,
                                ammPlugin: amm.contract._address,
                                liquidityPoolAddress: LPAddress
                            };
                        }
                    }else{
                        bestResult = {
                            tokenOutput,
                            ammPlugin: amm.contract._address,
                            liquidityPoolAddress: LPAddress
                        };
                    }
                }
        } catch(err) {
            if(VERBOSITY >= 1){
                console.log(err);
            }
        }
    }

    // the swap is just not happening
    return bestResult ? bestResult : null;
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
        var liquidityPoolToken = await fetchLPAddress(couple, amm);
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
    try{
        const pool = (await ammPlugin.contract.methods.byTokens(tokens).call())[2]; 
        return pool && pool !== utilities.voidEthereumAddress ? pool : null;
    }catch(err){
        // no pool found for any reason. not even need to print the error
        return null;
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
init(context.buidlTokenAddress, utilities.toDecimals('100', '18'), 6, [context.mkrTokenAddress, context.daiTokenAddress, context.wethTokenAddress]);

exports.findBestArbitragePath = init;