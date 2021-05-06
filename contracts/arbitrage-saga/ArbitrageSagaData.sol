//SPDX-License-Identifier: MIT
 pragma solidity ^0.7.6;
pragma abicoder v2;

struct ArbitrageSagaSwap {
    address ammPlugin;
    address[] liquidityPoolAddresses;
    address[] swapPath;

    bool enterInETH;
    bool exitInETH;
}

/** @notice arbitrage operation data structure. 
    @dev full descriptor of a series of swaps aimed to perform an arbitrage operation
*/
struct ArbitrageSagaOperation {
    address inputTokenAddress;
    uint256 inputTokenAmount;

    ArbitrageSagaSwap[] swaps;
    uint256 minExpectedEarnings;

    address[] receivers;
    uint256[] receiversPercentages;
}