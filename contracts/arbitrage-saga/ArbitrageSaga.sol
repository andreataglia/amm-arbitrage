  
//SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./util/DFOHub.sol";
import "../amm-aggregator/common/IAMM.sol";
import "./ArbitrageSagaData.sol";

contract ArbitrageSaga  {
    
    address public  doubleProxy;
    uint256 public  feePercentage;

    constructor(address _doubleProxy, uint256 _feePercentage) {
        doubleProxy = _doubleProxy;
        feePercentage = _feePercentage;
    }

    receive() external payable {
    }

    modifier onlyDFO() {
        require(IMVDFunctionalitiesManager(IMVDProxy(IDoubleProxy(doubleProxy).proxy()).getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(msg.sender), "Unauthorized.");
        _;
    }

    function feePercentageInfo() public  view returns (uint256, address) {
        return (feePercentage, IMVDProxy(IDoubleProxy(doubleProxy).proxy()).getMVDWalletAddress());
    }

    function setDoubleProxy(address _doubleProxy) public  onlyDFO {
        doubleProxy = _doubleProxy;
    }

    function setFeePercentage(uint256 _feePercentage) public onlyDFO {
        feePercentage = _feePercentage;
    }
    
    function swap(ArbitrageSagaOperation memory operation) public returns (uint256 amountWithdrawn, uint256 gain) {
        (IAMM sellAmm, SwapData memory sellSwap, IAMM buyAmm, SwapData  memory buySwap) = _calculateSwaps(operation);
    }
    
    function _calculateSwaps(ArbitrageSagaOperation memory operation) internal returns (IAMM sellAmm, SwapData memory sellSwap, IAMM buyAmm, SwapData memory buySwap) {
        
    }

}