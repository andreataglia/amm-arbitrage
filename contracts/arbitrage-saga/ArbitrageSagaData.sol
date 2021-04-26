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


// [["0x0000000000000000000000000000000000000000","500000000000000000",[["0xECbF237A71Da0159351965f16D0128f38f16a131",["0xB10cf58E08b94480fCb81d341A63295eBb2062C2"],["0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa"],true,false],["0xECbF237A71Da0159351965f16D0128f38f16a131",["0xB10cf58E08b94480fCb81d341A63295eBb2062C2", "0x44892ab8F7aFfB7e1AdA4Fb956CCE2a2f3049619"],["0xd0A1E359811322d97991E03f863a0C30C2cF029C", "0xb7a4F3E9097C08dA09517b5aB877F7a917224ede"],false,false],["0xECbF237A71Da0159351965f16D0128f38f16a131",["0x44892ab8F7aFfB7e1AdA4Fb956CCE2a2f3049619"],["0x0000000000000000000000000000000000000000"],false,true]],0], ["0x0000000000000000000000000000000000000000","500000000000000000",[["0xECbF237A71Da0159351965f16D0128f38f16a131",["0xB10cf58E08b94480fCb81d341A63295eBb2062C2"],["0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa"],true,false],["0xECbF237A71Da0159351965f16D0128f38f16a131",["0xB10cf58E08b94480fCb81d341A63295eBb2062C2", "0x44892ab8F7aFfB7e1AdA4Fb956CCE2a2f3049619"],["0xd0A1E359811322d97991E03f863a0C30C2cF029C", "0xb7a4F3E9097C08dA09517b5aB877F7a917224ede"],false,false],["0xECbF237A71Da0159351965f16D0128f38f16a131",["0x44892ab8F7aFfB7e1AdA4Fb956CCE2a2f3049619"],["0x0000000000000000000000000000000000000000"],false,true]],0]]