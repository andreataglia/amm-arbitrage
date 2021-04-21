//SPDX-License-Identifier: MIT
 pragma solidity ^0.7.6;
pragma abicoder v2;

struct ArbitrageSagaSwap {
    address inputTokenAddress;
    uint256 inputTokenAmount;
    
    address ammPlugin;
    address[] liquidityPoolAddresses;
    address[] swapPath;

    bool enterInETH;
    bool exitInETH;
}

// arbitrage operation data structure. full descriptor of a series of swaps aimed to performe an arbitrage operation
struct ArbitrageSagaOperation {
    ArbitrageSagaSwap[] swaps;
    uint256 minExpectedEarnings;
}