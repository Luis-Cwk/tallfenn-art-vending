// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract ArtVendor is ERC721, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    struct Artwork {
        address artist;
        uint256 price;
        uint32 editions;
        uint32 sold;
        string seedInput;
        bytes32 seedHash;
        string seriesName;
        address[] recipients;
        uint16[] sharesBps;
    }

    struct ReceiptMetadata {
        uint256 artworkId;
        uint32 editionNumber;
    }

    error ZeroAddress();
    error ZeroPrice();
    error ZeroEditions();
    error TooManyRecipients();
    error ArrayLengthMismatch();
    error ShareSumInvalid();
    error ZeroShare();
    error InvalidString();
    error StringTooLong();
    error ArtworkNotFound();
    error EditionsSoldOut();
    error PayoutFailed();
    error InvalidBase();

    event ArtworkListed(
        uint256 indexed artworkId,
        address indexed artist,
        uint256 price,
        uint32 editions,
        string seriesName,
        bytes32 seedHash
    );
    event ArtworkSold(uint256 indexed artworkId, address indexed buyer, uint32 editionNumber, uint256 price, uint256 tokenId);
    event PayoutSent(uint256 indexed artworkId, address indexed recipient, uint256 amount);
    event ArtworkRecipientsUpdated(uint256 indexed artworkId, address[] recipients, uint16[] sharesBps);

    IERC20 public immutable usdc;
    string public imageBase;
    string public appBase;
    mapping(uint256 => Artwork) private _artworks;
    uint256 private _artworkCount;
    uint256 private _nextTokenId;
    mapping(uint256 => ReceiptMetadata) private _receiptMetadata;

    constructor(address usdcToken, address initialOwner, string memory imageBase_, string memory appBase_)
        ERC721("Tall Fenn Receipt", "TFENN")
        Ownable(initialOwner)
    {
        if (usdcToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        if (bytes(imageBase_).length == 0 || bytes(appBase_).length == 0) revert InvalidBase();
        // All price amounts are in ERC-20 interface units (6 decimals on Arc).
        // Do NOT confuse with the native gas-token view which uses 18 decimals.
        usdc = IERC20(usdcToken);
        imageBase = imageBase_;
        appBase = appBase_;
        _nextTokenId = 1;
    }

    function listArtwork(
        uint256 price,
        uint32 editions,
        string calldata seedInput,
        string calldata seriesName,
        address[] calldata recipients,
        uint16[] calldata sharesBps
    ) external onlyOwner returns (uint256 artworkId) {
        _validateListArtwork(price, editions, recipients, sharesBps, seedInput, seriesName);
        bytes32 seedHash = sha256(abi.encodePacked(seedInput, "|v1|tallfenn"));

        artworkId = _artworkCount;
        _artworkCount++;

        Artwork storage art = _artworks[artworkId];
        art.artist = owner();
        art.price = price;
        art.editions = editions;
        art.seedInput = seedInput;
        art.seedHash = seedHash;
        art.seriesName = seriesName;

        uint256 len = recipients.length;
        for (uint256 i = 0; i < len; ) {
            art.recipients.push(recipients[i]);
            art.sharesBps.push(sharesBps[i]);
            unchecked {
                ++i;
            }
        }

        emit ArtworkListed(artworkId, art.artist, art.price, art.editions, art.seriesName, art.seedHash);
    }

    function _validateListArtwork(
        uint256 price,
        uint32 editions,
        address[] calldata recipients,
        uint16[] calldata sharesBps,
        string calldata seedInput,
        string calldata seriesName
    ) private pure {
        if (price == 0) revert ZeroPrice();
        if (editions == 0) revert ZeroEditions();
        _validateJsonString(seedInput, 256);
        _validateJsonString(seriesName, 64);
        _validateRecipients(recipients, sharesBps);
    }

    function _validateRecipients(address[] calldata recipients, uint16[] calldata sharesBps) private pure {
        uint256 len = recipients.length;
        if (len == 0 || len > 4) revert TooManyRecipients();
        if (sharesBps.length != len) revert ArrayLengthMismatch();
        uint256 sum = 0;
        for (uint256 i = 0; i < len; ) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (sharesBps[i] == 0) revert ZeroShare();
            sum += sharesBps[i];
            unchecked {
                ++i;
            }
        }
        if (sum != 10_000) revert ShareSumInvalid();
    }

    function _validateJsonString(string calldata s, uint256 maxLen) private pure {
        bytes calldata b = bytes(s);
        if (b.length > maxLen) revert StringTooLong();
        for (uint256 i = 0; i < b.length; ) {
            if (b[i] == 0x22 || b[i] == 0x5c) revert InvalidString();
            unchecked {
                ++i;
            }
        }
    }

    function buy(uint256 artworkId) external whenNotPaused {
        if (artworkId >= _artworkCount) revert ArtworkNotFound();

        Artwork storage art = _artworks[artworkId];
        if (art.sold >= art.editions) revert EditionsSoldOut();

        uint256 price = art.price;
        usdc.safeTransferFrom(msg.sender, address(this), price);

        uint256 recipientCount = art.recipients.length;
        uint256[] memory amounts = new uint256[](recipientCount);
        uint256 distributed = 0;

        for (uint256 i = 0; i < recipientCount; i++) {
            uint256 amount = (price * art.sharesBps[i]) / 10_000;
            amounts[i] = amount;
            distributed += amount;
        }

        uint256 remainder = price - distributed;
        amounts[0] += remainder;

        for (uint256 i = 0; i < recipientCount; i++) {
            usdc.safeTransfer(art.recipients[i], amounts[i]);
            emit PayoutSent(artworkId, art.recipients[i], amounts[i]);
        }

        art.sold += 1;
        uint32 editionNumber = art.sold;

        uint256 tokenId = _nextTokenId;
        _nextTokenId = tokenId + 1;

        _mint(msg.sender, tokenId);
        _receiptMetadata[tokenId] = ReceiptMetadata({artworkId: artworkId, editionNumber: editionNumber});

        emit ArtworkSold(artworkId, msg.sender, editionNumber, price, tokenId);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function updateArtworkRecipients(
        uint256 artworkId,
        address[] calldata recipients,
        uint16[] calldata sharesBps
    ) external onlyOwner {
        if (artworkId >= _artworkCount) revert ArtworkNotFound();
        _validateRecipients(recipients, sharesBps);

        Artwork storage art = _artworks[artworkId];
        // Clear existing arrays
        delete art.recipients;
        delete art.sharesBps;
        // Repopulate
        uint256 len = recipients.length;
        for (uint256 i = 0; i < len; ) {
            art.recipients.push(recipients[i]);
            art.sharesBps.push(sharesBps[i]);
            unchecked {
                ++i;
            }
        }

        emit ArtworkRecipientsUpdated(artworkId, recipients, sharesBps);
    }

    function artworkCount() external view returns (uint256) {
        return _artworkCount;
    }

    function artworks(uint256 artworkId) external view returns (Artwork memory) {
        if (artworkId >= _artworkCount) revert ArtworkNotFound();
        return _artworks[artworkId];
    }

    function soldOf(uint256 artworkId) external view returns (uint32) {
        if (artworkId >= _artworkCount) revert ArtworkNotFound();
        return _artworks[artworkId].sold;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        ReceiptMetadata memory receipt = _receiptMetadata[tokenId];
        Artwork storage art = _artworks[receipt.artworkId];

        string memory hashHex = _bytes32ToHexStringNoPrefix(art.seedHash);
        string memory json = string(
            abi.encodePacked(
                '{"name":"Tall Fenn - ',
                art.seriesName,
                ' #',
                uint256(receipt.editionNumber).toString(),
                '","description":"',
                art.seedInput,
                '","image":"',
                imageBase,
                hashHex,
                '.png","animation_url":"',
                appBase,
                'live?h=',
                hashHex,
                '","external_url":"',
                appBase,
                '","attributes":[',
                '{"trait_type":"Seed Hash","value":"',
                _bytes32ToHexString(art.seedHash),
                '"},',
                '{"trait_type":"Series","value":"',
                art.seriesName,
                '"},',
                '{"trait_type":"Artwork ID","value":"',
                receipt.artworkId.toString(),
                '"},',
                '{"trait_type":"Edition","value":"',
                uint256(receipt.editionNumber).toString(),
                '"}',
                ']}'
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _bytes32ToHexString(bytes32 data) internal pure returns (string memory) {
        bytes16 hexSymbols = "0123456789abcdef";
        bytes memory str = new bytes(66);

        str[0] = "0";
        str[1] = "x";

        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(data[i]);
            str[2 + (i * 2)] = hexSymbols[b >> 4];
            str[3 + (i * 2)] = hexSymbols[b & 0x0f];
        }

        return string(str);
    }

    /// Returns the lowercase hex encoding of a bytes32 value WITHOUT the 0x prefix (64 chars).
    function _bytes32ToHexStringNoPrefix(bytes32 data) internal pure returns (string memory) {
        bytes16 hexSymbols = "0123456789abcdef";
        bytes memory str = new bytes(64);

        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(data[i]);
            str[i * 2]     = hexSymbols[b >> 4];
            str[i * 2 + 1] = hexSymbols[b & 0x0f];
        }

        return string(str);
    }
}
