◇ injected env (3) from .env // tip: ⌘ suppress logs { quiet: true }
// Sources flattened with hardhat v3.4.5 https://hardhat.org

// SPDX-License-Identifier: MIT

// File npm/@chainlink/contracts-ccip@1.6.4/contracts/libraries/Client.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

// End consumer library.
library Client {
  /// @dev RMN depends on this struct, if changing, please notify the RMN maintainers.
  struct EVMTokenAmount {
    address token; // token address on the local chain.
    uint256 amount; // Amount of tokens.
  }

  struct Any2EVMMessage {
    bytes32 messageId; // MessageId corresponding to ccipSend on source.
    uint64 sourceChainSelector; // Source chain selector.
    bytes sender; // abi.decode(sender) if coming from an EVM chain.
    bytes data; // payload sent in original message.
    EVMTokenAmount[] destTokenAmounts; // Tokens and their amounts in their destination chain representation.
  }

  // If extraArgs is empty bytes, the default is 200k gas limit.
  struct EVM2AnyMessage {
    bytes receiver; // abi.encode(receiver address) for dest EVM chains.
    bytes data; // Data payload.
    EVMTokenAmount[] tokenAmounts; // Token transfers.
    address feeToken; // Address of feeToken. address(0) means you will send msg.value.
    bytes extraArgs; // Populate this with _argsToBytes(EVMExtraArgsV2).
  }

  // Tag to indicate only a gas limit. Only usable for EVM as destination chain.
  bytes4 public constant EVM_EXTRA_ARGS_V1_TAG = 0x97a657c9;

  struct EVMExtraArgsV1 {
    uint256 gasLimit;
  }

  function _argsToBytes(
    EVMExtraArgsV1 memory extraArgs
  ) internal pure returns (bytes memory bts) {
    return abi.encodeWithSelector(EVM_EXTRA_ARGS_V1_TAG, extraArgs);
  }

  // Tag to indicate a gas limit (or dest chain equivalent processing units) and Out Of Order Execution. This tag is
  // available for multiple chain families. If there is no chain family specific tag, this is the default available
  // for a chain.
  // Note: not available for Solana VM based chains.
  bytes4 public constant GENERIC_EXTRA_ARGS_V2_TAG = 0x181dcf10;

  /// @param gasLimit: gas limit for the callback on the destination chain.
  /// @param allowOutOfOrderExecution: if true, it indicates that the message can be executed in any order relative to
  /// other messages from the same sender. This value's default varies by chain. On some chains, a particular value is
  /// enforced, meaning if the expected value is not set, the message request will revert.
  /// @dev Fully compatible with the previously existing EVMExtraArgsV2.
  struct GenericExtraArgsV2 {
    uint256 gasLimit;
    bool allowOutOfOrderExecution;
  }

  // Extra args tag for chains that use the Sui VM.
  bytes4 public constant SUI_EXTRA_ARGS_V1_TAG = 0x21ea4ca9;

  // Extra args tag for chains that use the Solana VM.
  bytes4 public constant SVM_EXTRA_ARGS_V1_TAG = 0x1f3b3aba;

  struct SVMExtraArgsV1 {
    uint32 computeUnits;
    uint64 accountIsWritableBitmap;
    bool allowOutOfOrderExecution;
    bytes32 tokenReceiver;
    // Additional accounts needed for execution of CCIP receiver. Must be empty if message.receiver is zero.
    // Token transfer related accounts are specified in the token pool lookup table on SVM.
    bytes32[] accounts;
  }

  /// @dev The maximum number of accounts that can be passed in SVMExtraArgs.
  uint256 public constant SVM_EXTRA_ARGS_MAX_ACCOUNTS = 64;

  /// @dev The expected static payload size of a token transfer when Borsh encoded and submitted to SVM.
  /// TokenPool extra data and offchain data sizes are dynamic, and should be accounted for separately.
  uint256 public constant SVM_TOKEN_TRANSFER_DATA_OVERHEAD = (4 + 32) // source_pool
    + 32 // token_address
    + 4 // gas_amount
    + 4 // extra_data overhead
    + 32 // amount
    + 32 // size of the token lookup table account
    + 32 // token-related accounts in the lookup table, over-estimated to 32, typically between 11 - 13
    + 32 // token account belonging to the token receiver, e.g ATA, not included in the token lookup table
    + 32 // per-chain token pool config, not included in the token lookup table
    + 32 // per-chain token billing config, not always included in the token lookup table
    + 32; // OffRamp pool signer PDA, not included in the token lookup table

  /// @dev Number of overhead accounts needed for message execution on SVM.
  /// @dev These are message.receiver, and the OffRamp Signer PDA specific to the receiver.
  uint256 public constant SVM_MESSAGING_ACCOUNTS_OVERHEAD = 2;

  /// @dev The size of each SVM account address in bytes.
  uint256 public constant SVM_ACCOUNT_BYTE_SIZE = 32;

  struct SuiExtraArgsV1 {
    uint256 gasLimit;
    bool allowOutOfOrderExecution;
    bytes32 tokenReceiver;
    bytes32[] receiverObjectIds;
  }

  /// @dev The expected static payload size of a token transfer when BCS encoded and submitted to SUI.
  /// TokenPool extra data and offchain data sizes are dynamic, and should be accounted for separately.
  uint256 public constant SUI_TOKEN_TRANSFER_DATA_OVERHEAD = (4 + 32) // source_pool, 4 bytes for length, 32 bytes for address
    + 32 // dest_token_address
    + 4 // dest_gas_amount
    + 4 // extra_data length, the contents are calculated separately
    + 32; // amount

  /// @dev Number of overhead accounts needed for message execution on SUI.
  /// @dev This is the message.receiver.
  uint256 public constant SUI_MESSAGING_ACCOUNTS_OVERHEAD = 1;

  /// @dev The maximum number of receiver object ids that can be passed in SuiExtraArgs.
  uint256 public constant SUI_EXTRA_ARGS_MAX_RECEIVER_OBJECT_IDS = 64;

  /// @dev The size of each SUI account address in bytes.
  uint256 public constant SUI_ACCOUNT_BYTE_SIZE = 32;

  function _argsToBytes(
    GenericExtraArgsV2 memory extraArgs
  ) internal pure returns (bytes memory bts) {
    return abi.encodeWithSelector(GENERIC_EXTRA_ARGS_V2_TAG, extraArgs);
  }

  function _svmArgsToBytes(
    SVMExtraArgsV1 memory extraArgs
  ) internal pure returns (bytes memory bts) {
    return abi.encodeWithSelector(SVM_EXTRA_ARGS_V1_TAG, extraArgs);
  }

  function _suiArgsToBytes(
    SuiExtraArgsV1 memory extraArgs
  ) internal pure returns (bytes memory bts) {
    return abi.encodeWithSelector(SUI_EXTRA_ARGS_V1_TAG, extraArgs);
  }
}


// File npm/@chainlink/contracts-ccip@1.6.4/contracts/interfaces/IAny2EVMMessageReceiver.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

/// @notice Application contracts that intend to receive messages from  the router should implement this interface.
interface IAny2EVMMessageReceiver {
  /// @notice Called by the Router to deliver a message. If this reverts, any token transfers also revert.
  /// The message will move to a FAILED state and become available for manual execution.
  /// @param message CCIP Message.
  /// @dev Note ensure you check the msg.sender is the OffRampRouter.
  function ccipReceive(
    Client.Any2EVMMessage calldata message
  ) external;
}


// File npm/@openzeppelin/contracts@5.0.2/utils/introspection/IERC165.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/introspection/IERC165.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File npm/@chainlink/contracts-ccip@1.6.4/contracts/applications/CCIPReceiver.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.4;

/// @title CCIPReceiver - Base contract for CCIP applications that can receive messages.
abstract contract CCIPReceiver is IAny2EVMMessageReceiver, IERC165 {
  address internal immutable i_ccipRouter;

  constructor(
    address router
  ) {
    if (router == address(0)) revert InvalidRouter(address(0));
    i_ccipRouter = router;
  }

  /// @notice IERC165 supports an interfaceId.
  /// @param interfaceId The interfaceId to check.
  /// @return true if the interfaceId is supported.
  /// @dev Should indicate whether the contract implements IAny2EVMMessageReceiver.
  /// e.g. return interfaceId == type(IAny2EVMMessageReceiver).interfaceId || interfaceId == type(IERC165).interfaceId
  /// This allows CCIP to check if ccipReceive is available before calling it.
  /// - If this returns false or reverts, only tokens are transferred to the receiver.
  /// - If this returns true, tokens are transferred and ccipReceive is called atomically.
  /// Additionally, if the receiver address does not have code associated with it at the time of
  /// execution (EXTCODESIZE returns 0), only tokens will be transferred.
  function supportsInterface(
    bytes4 interfaceId
  ) public pure virtual override returns (bool) {
    return interfaceId == type(IAny2EVMMessageReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
  }

  /// @inheritdoc IAny2EVMMessageReceiver
  function ccipReceive(
    Client.Any2EVMMessage calldata message
  ) external virtual override onlyRouter {
    _ccipReceive(message);
  }

  /// @notice Override this function in your implementation.
  /// @param message Any2EVMMessage.
  function _ccipReceive(
    Client.Any2EVMMessage memory message
  ) internal virtual;

  /// @notice Return the current router
  /// @return CCIP router address
  function getRouter() public view virtual returns (address) {
    return address(i_ccipRouter);
  }

  error InvalidRouter(address router);

  /// @dev only calls from the set router are accepted.
  modifier onlyRouter() {
    if (msg.sender != getRouter()) revert InvalidRouter(msg.sender);
    _;
  }
}


// File contracts/CCIPWeatherOracle.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.28;


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

