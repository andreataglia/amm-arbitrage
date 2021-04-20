//SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;


struct AmmLiquidityPools {
    address ammPlugin;
    address[] liquidityPoolAddresses;
}

struct ArbitrageSagaOperation {
    address inputTokenAddress;
    uint256 inputTokenAmount;
    address[] AmmLiquidityPools;
    address[] swapPath;
    bool enterInETH;
    uint8 pivotIndex;
    address[] receivers;
    uint256[] receiversPercentages;
}