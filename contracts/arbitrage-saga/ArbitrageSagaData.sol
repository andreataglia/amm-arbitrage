//SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;


// arbitrage operation data structure. full descriptor of a series of swaps aimed to performe an arbitrage operation
struct ArbitrageSagaOperation {
    address inputTokenAddress;
    uint256 inputTokenAmount;

    address ammPlugin;
    address[] liquidityPoolAddresses;
    address[] swapPath;
    bool enterInETH;
    bool exitInETH;

    address[] receivers;
    uint256[] receiversPercentages;

    uint256 expectedEarningsAmount;
    uint256 allowedEarningsSlippage;
}