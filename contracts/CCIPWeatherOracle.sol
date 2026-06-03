// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

interface IWeatherMarket {
    function submitResult(uint256 marketId, int256 finalTemp) external;
}

contract CCIPWeatherOracle is CCIPReceiver {
    address public immutable weatherMarket;
    address public owner;

    // sourceChainSelector => sender => allowed
    mapping(uint64 => mapping(address => bool)) public allowedSenders;

    event ResultSubmitted(
        uint64 indexed sourceChainSelector,
        address indexed sender,
        uint256 indexed marketId,
        int256 finalTemp
    );
    event SenderAllowed(uint64 sourceChainSelector, address sender, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "CCIPWeatherOracle: not owner");
        _;
    }

    modifier onlyAllowedSender(uint64 sourceChainSelector, address sender) {
        require(
            allowedSenders[sourceChainSelector][sender],
            "CCIPWeatherOracle: sender not allowed"
        );
        _;
    }

    constructor(address router, address _weatherMarket, address _owner) CCIPReceiver(router) {
        require(_weatherMarket != address(0), "CCIPWeatherOracle: zero weatherMarket");
        require(_owner != address(0), "CCIPWeatherOracle: zero owner");
        weatherMarket = _weatherMarket;
        owner = _owner;
    }

    // owner 設定允許的發送方（sourceChainSelector + sender 組合）
    function setAllowedSender(
        uint64 sourceChainSelector,
        address sender,
        bool allowed
    ) external onlyOwner {
        allowedSenders[sourceChainSelector][sender] = allowed;
        emit SenderAllowed(sourceChainSelector, sender, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "CCIPWeatherOracle: zero newOwner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // CCIP 收到訊息後自動呼叫
    // 訊息格式：abi.encode(uint256 marketId, int256 finalTemp)
    function _ccipReceive(
        Client.Any2EVMMessage memory message
    )
        internal
        override
        onlyAllowedSender(
            message.sourceChainSelector,
            abi.decode(message.sender, (address))
        )
    {
        address sender = abi.decode(message.sender, (address));
        (uint256 marketId, int256 finalTemp) = abi.decode(message.data, (uint256, int256));

        IWeatherMarket(weatherMarket).submitResult(marketId, finalTemp);

        emit ResultSubmitted(message.sourceChainSelector, sender, marketId, finalTemp);
    }
}
