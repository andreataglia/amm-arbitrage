  
//SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./util/DFOHub.sol";
import "../amm-aggregator/common/IAMM.sol";
import "./ArbitrageSagaData.sol";
import "./util/IERC20.sol";

/// @title ArbitrageSaga
/// @notice Performs single transaction arbitrage operation exploiting the AMMAggregator
/// @dev An arbitrage bath has to be calculated elsewhere. The contract supports batch swap. The input token and the output token of each swap must match
contract ArbitrageSaga {

    uint256 public constant ONE_HUNDRED = 1e18;

    mapping(address => uint256) private _tokenIndex;
    address[] private _tokensToTransfer;
    uint256[] private _tokenAmounts;

    address public doubleProxy;
    uint256 public feePercentage;

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

    function feePercentageInfo() public view returns (uint256, address) {
        return (feePercentage, IMVDProxy(IDoubleProxy(doubleProxy).proxy()).getMVDWalletAddress());
    }

    function setDoubleProxy(address _doubleProxy) public onlyDFO {
        doubleProxy = _doubleProxy;
    }

    /** @dev Sets percentage to be taken away from the DFO at each succesfull arbitrage operation
     */
    function setFeePercentage(uint256 _feePercentage) public onlyDFO {
        feePercentage = _feePercentage;
    }

    /** @notice Execute arbitrage operations given a certain swap path. 
        @dev It takes into account an expectedEarningsAmount and a allowedEarningsSlippage. If an operation leads to a final amount of token lower than expectedEarningsAmount - minExpectedEarnings, it reverts.
        @param operations data struct containing the data regarding the operations to be executed. Every operation represents a single input token. multi token arbitrage operations is possibile via multiple operations as input.
    */
    function execute(ArbitrageSagaOperation[] memory operations) public payable {
        _transferToMe(operations);
        for(uint256 i = 0 ; i < operations.length; i++) {
            ArbitrageSagaOperation memory operation = operations[i];
            ArbitrageSagaSwap[] memory swaps = operation.swaps;
            
            address latestSwapTokenAddress = operation.inputTokenAddress;
            uint256 latestSwapOutputAmount = operation.inputTokenAmount;

            for(uint256 k = 0 ; k < swaps.length; k++) {
                // the output of one swap becomes the input of the next swap operation
                (latestSwapTokenAddress, latestSwapOutputAmount) = _swap(swaps[k], latestSwapTokenAddress, latestSwapOutputAmount);
            }
            ArbitrageSagaSwap memory finalSwap = swaps[swaps.length - 1];

            // transfer back tokens to receivers
            _checkFinalEarnings(operation, latestSwapTokenAddress, latestSwapOutputAmount);
            _transferTo(finalSwap.exitInETH ? address(0) : latestSwapTokenAddress, latestSwapOutputAmount, operation.receivers, operation.receiversPercentages);
        }
        _flushAndClear();
    }

    /** @notice check whether the earnings are at least what expected, reverts otherwise 
        @dev If minExpectedEarnings < totalEarnings reverts.
        @param outputTokenAddress latest swap output token address
        @param outputTokenAmount latest swap output token amount
     */
    function _checkFinalEarnings(ArbitrageSagaOperation memory operation, address outputTokenAddress, uint256 outputTokenAmount) private view {
        (address ethereumAddress,,) = IAMM(operation.swaps[0].ammPlugin).data();
        address inputTokenAddress = operation.swaps[0].enterInETH ? ethereumAddress : operation.inputTokenAddress; 
        // check output token is same as input token so as to calculate the totalEarnings 
        require(inputTokenAddress == outputTokenAddress, "ArbitrageSaga Revert: operation output token address differs than the input token address");
        uint256 inputTokenAmount = operation.inputTokenAmount; 
        require(outputTokenAmount + operation.minExpectedEarnings >= inputTokenAmount, "ArbitrageSaga Revert: operation output amount is lower than the expected earnings");
    }

    /** @notice Transfer to the currently deployed contract all the tokens from the operations as the operation can start
     */
    function _transferToMe(ArbitrageSagaOperation[] memory operations) private {
        _collectTokens(operations);
        for(uint256 i = 0; i < _tokensToTransfer.length; i++) {
            if(_tokensToTransfer[i] == address(0)) {
                require(msg.value == _tokenAmounts[i], "SAGA: Incorrect ETH value");
            } else {
                _safeTransferFrom(_tokensToTransfer[i], msg.sender, address(this), _tokenAmounts[i]);
            }
        }
    }

    /** @dev Optimize token collection to reduce gas cost in the case of multiple tokens used on different operations
     */
    function _collectTokens(ArbitrageSagaOperation[] memory operations) private {
        for(uint256 i = 0; i < operations.length; i++) {
            ArbitrageSagaSwap memory swap = operations[i].swaps[0];
            _collectTokenData(swap.enterInETH ? address(0) : operations[i].inputTokenAddress, operations[i].inputTokenAmount);
        }
    }

    function _collectTokenData(address inputTokenAddress, uint256 inputTokenAmount) private {
        if(inputTokenAmount == 0) {
            return;
        }

        uint256 position = _tokenIndex[inputTokenAddress];

        if(_tokensToTransfer.length == 0 || _tokensToTransfer[position] != inputTokenAddress) {
            _tokenIndex[inputTokenAddress] = (position = _tokensToTransfer.length);
            _tokensToTransfer.push(inputTokenAddress);
            _tokenAmounts.push(0);
        }
        _tokenAmounts[position] = _tokenAmounts[position] + inputTokenAmount;
    }

    function _flushAndClear() private {
        for(uint256 i = 0; i < _tokensToTransfer.length; i++) {
            _safeTransfer(_tokensToTransfer[i], msg.sender, _balanceOf(_tokensToTransfer[i]));
            delete _tokenIndex[_tokensToTransfer[i]];
        }
        delete _tokensToTransfer;
        delete _tokenAmounts;
    }

    function _balanceOf(address tokenAddress) private view returns(uint256) {
        if(tokenAddress == address(0)) {
            return address(this).balance;
        }
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /** @notice Performs a swap for a certain amm and a swapPath/liquidityPoolAddresses.
        @return outputTokenAdress outputTokenAmount The outputTokenAdress and outputTokenAmount at the end of the swap operation
     */
    function _swap(ArbitrageSagaSwap memory swap, address inputTokenAddress, uint256 inputTokenAmount) private returns (address outputTokenAdress, uint256 outputTokenAmount) {

        (address ethereumAddress,,) = IAMM(swap.ammPlugin).data();

        if(swap.exitInETH) {
            swap.swapPath[swap.swapPath.length - 1] = ethereumAddress;
        }

        address outputToken = swap.swapPath[swap.swapPath.length - 1];

        SwapData memory swapData = SwapData(
            swap.enterInETH,
            swap.exitInETH,
            swap.liquidityPoolAddresses,
            swap.swapPath,
            swap.enterInETH ? ethereumAddress : inputTokenAddress,
            inputTokenAmount,
            address(this)
        );

        if(!swapData.enterInETH) {
            _safeApprove(swapData.inputToken, swap.ammPlugin, swapData.amount);
        }

        uint256 amountOut;
        if(swapData.enterInETH) {
            amountOut = IAMM(swap.ammPlugin).swapLiquidity{value : inputTokenAmount}(swapData);
        } else {
            amountOut = IAMM(swap.ammPlugin).swapLiquidity(swapData);
        }

        return (outputToken, amountOut);
    }

    /** @param totalAmount amount to calculate percentage upon
        @param rewardPercentage expressed as a percentage between 0 and 100
        @return TotalAmount * rewardPercentage (expressed as a float number between 0 and 1)
     */
    function _calculateRewardPercentage(uint256 totalAmount, uint256 rewardPercentage) private pure returns (uint256) {
        return (totalAmount * ((rewardPercentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }

    /** @dev Transfer a totalAmount of tokens to some receivers, including a fee to be sent to the dfo. The fee is taken away from every transfer to each of the receivers.
     */
    function _transferTo(address erc20TokenAddress, uint256 totalAmount, address[] memory receivers, uint256[] memory receiversPercentages) private {
        uint256 availableAmount = totalAmount;

        (uint256 dfoFeePercentage, address dfoWallet) = feePercentageInfo();
        uint256 currentPartialAmount = dfoFeePercentage == 0 || dfoWallet == address(0) ? 0 : _calculateRewardPercentage(availableAmount, dfoFeePercentage);
        _safeTransfer(erc20TokenAddress, dfoWallet, currentPartialAmount);
        availableAmount -= currentPartialAmount;

        uint256 stillAvailableAmount = availableAmount;

        for(uint256 i = 0; i < receivers.length - 1; i++) {
            _safeTransfer(erc20TokenAddress, receivers[i], currentPartialAmount = _calculateRewardPercentage(stillAvailableAmount, receiversPercentages[i]));
            availableAmount -= currentPartialAmount;
        }

        _safeTransfer(erc20TokenAddress, receivers[receivers.length - 1], availableAmount);
    }

    function _safeApprove(address erc20TokenAddress, address to, uint256 value) internal {
        bytes memory returnData = _call(erc20TokenAddress, abi.encodeWithSelector(IERC20(erc20TokenAddress).approve.selector, to, value));
        require(returnData.length == 0 || abi.decode(returnData, (bool)), 'APPROVE_FAILED');
    }

    function _safeTransfer(address erc20TokenAddress, address to, uint256 value) private {
        if(value == 0) {
            return;
        }
        if(erc20TokenAddress == address(0)) {
            (bool result,) = to.call{value:value}("");
            require(result, "ETH transfer failed");
            return;
        }
        bytes memory returnData = _call(erc20TokenAddress, abi.encodeWithSelector(IERC20(erc20TokenAddress).transfer.selector, to, value));
        require(returnData.length == 0 || abi.decode(returnData, (bool)), 'TRANSFER_FAILED');
    }

    function _safeTransferFrom(address erc20TokenAddress, address from, address to, uint256 value) internal {
        bytes memory returnData = _call(erc20TokenAddress, abi.encodeWithSelector(IERC20(erc20TokenAddress).transferFrom.selector, from, to, value));
        require(returnData.length == 0 || abi.decode(returnData, (bool)), 'TRANSFERFROM_FAILED');
    }

    function _call(address location, bytes memory payload) private returns(bytes memory returnData) {
        assembly {
            let result := call(gas(), location, 0, add(payload, 0x20), mload(payload), 0, 0)
            let size := returndatasize()
            returnData := mload(0x40)
            mstore(returnData, size)
            let returnDataPayloadStart := add(returnData, 0x20)
            returndatacopy(returnDataPayloadStart, 0, size)
            mstore(0x40, add(returnDataPayloadStart, size))
            switch result case 0 {revert(returnDataPayloadStart, size)}
        }
    }

}


