// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ArtVendor} from "../ArtVendor.sol";

// ---------------------------------------------------------------------------
// Simple mock ERC-20 used in most tests
// ---------------------------------------------------------------------------
contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ---------------------------------------------------------------------------
// Blocklist-aware mock used in testBrickAndRecovery
// ---------------------------------------------------------------------------
contract MockBlocklistableUSDC is ERC20 {
    uint8 private _dec;
    mapping(address => bool) public blocklisted;

    constructor() ERC20("Mock Blocklist USDC", "mBLUSDC") {
        _dec = 6;
    }

    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function addToBlocklist(address account) external {
        blocklisted[account] = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(!blocklisted[msg.sender] && !blocklisted[to], "BLOCKLISTED");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(!blocklisted[from] && !blocklisted[to], "BLOCKLISTED");
        return super.transferFrom(from, to, amount);
    }
}

// ---------------------------------------------------------------------------
// Main test contract
// ---------------------------------------------------------------------------
contract ArtVendorTest is Test {
    ArtVendor   internal vendor;
    MockERC20   internal usdc;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");   // buyer
    address internal recip0  = makeAddr("recip0");
    address internal recip1  = makeAddr("recip1");
    address internal recip2  = makeAddr("recip2");
    address internal recip3  = makeAddr("recip3");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant PRICE        = 1_000_000;   // 1 USDC (6-dec unit)
    uint256 internal constant BUYER_SUPPLY = 100_000_000; // plenty

    // Default valid list params
    string  internal constant SEED      = "A gentle forest at dawn";
    string  internal constant SERIES    = "Forest Series";
    uint32  internal constant EDITIONS  = 5;

    // Base URL constants for constructor
    string  internal constant IMAGE_BASE = "https://tallfenn-art-vending.petrasynthetic.workers.dev/posters/";
    string  internal constant APP_BASE   = "https://tallfenn-art-vending.petrasynthetic.workers.dev/";

    function setUp() public {
        // Deploy a fresh MockERC20 and a fresh ArtVendor before every test.
        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.prank(owner);
        vendor = new ArtVendor(address(usdc), owner, IMAGE_BASE, APP_BASE);

        // Give alice enough USDC and a blanket approval.
        usdc.mint(alice, BUYER_SUPPLY);
        vm.prank(alice);
        usdc.approve(address(vendor), type(uint256).max);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// List a default valid artwork as owner; returns artworkId.
    function _listDefault(uint32 editions) internal returns (uint256 artworkId) {
        address[] memory recips = new address[](2);
        recips[0] = recip0;
        recips[1] = recip1;
        uint16[] memory shares = new uint16[](2);
        shares[0] = 8000;
        shares[1] = 2000;
        vm.prank(owner);
        artworkId = vendor.listArtwork(PRICE, editions, SEED, SERIES, recips, shares);
    }

    function _twoRecipients(address r0, address r1, uint16 s0, uint16 s1)
        internal pure returns (address[] memory recips, uint16[] memory shares)
    {
        recips = new address[](2);
        recips[0] = r0;
        recips[1] = r1;
        shares = new uint16[](2);
        shares[0] = s0;
        shares[1] = s1;
    }

    // -----------------------------------------------------------------------
    // 0. Constructor
    // -----------------------------------------------------------------------

    function testConstructor_SetsUSDC() public view {
        assertEq(address(vendor.usdc()), address(usdc));
    }

    function testConstructor_SetsOwner() public view {
        assertEq(vendor.owner(), owner);
    }

    function testConstructor_ZeroUSDCReverts() public {
        vm.expectRevert(ArtVendor.ZeroAddress.selector);
        new ArtVendor(address(0), owner, IMAGE_BASE, APP_BASE);
    }

    function testConstructor_ZeroOwnerReverts() public {
        // OZ Ownable(address(0)) throws OwnableInvalidOwner before our ZeroAddress check.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new ArtVendor(address(usdc), address(0), IMAGE_BASE, APP_BASE);
    }

    function testConstructor_EmptyImageBaseReverts() public {
        vm.expectRevert(ArtVendor.InvalidBase.selector);
        new ArtVendor(address(usdc), owner, "", APP_BASE);
    }

    function testConstructor_EmptyAppBaseReverts() public {
        vm.expectRevert(ArtVendor.InvalidBase.selector);
        new ArtVendor(address(usdc), owner, IMAGE_BASE, "");
    }

    function testConstructor_StoresImmutables() public view {
        assertEq(vendor.imageBase(), IMAGE_BASE);
        assertEq(vendor.appBase(), APP_BASE);
    }

    // -----------------------------------------------------------------------
    // 1. listArtwork — validation failures
    // -----------------------------------------------------------------------

    function testListRevertZeroPrice() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.ZeroPrice.selector);
        vendor.listArtwork(0, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testListRevertZeroEditions() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.ZeroEditions.selector);
        vendor.listArtwork(PRICE, 0, SEED, SERIES, recips, shares);
    }

    function testListRevertTooManyRecipients() public {
        // 5 recipients → TooManyRecipients
        address[] memory recips = new address[](5);
        recips[0] = recip0; recips[1] = recip1; recips[2] = recip2; recips[3] = recip3;
        recips[4] = makeAddr("recip4");
        uint16[] memory shares = new uint16[](5);
        shares[0] = 2000; shares[1] = 2000; shares[2] = 2000; shares[3] = 2000; shares[4] = 2000;
        vm.prank(owner);
        vm.expectRevert(ArtVendor.TooManyRecipients.selector);
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testListRevertZeroRecipients() public {
        // 0 recipients → TooManyRecipients (same guard: len == 0 || len > 4)
        address[] memory recips = new address[](0);
        uint16[] memory shares  = new uint16[](0);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.TooManyRecipients.selector);
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testListRevertBadShareSum() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 8000, 1000);
        // Sum = 9000 ≠ 10000
        vm.prank(owner);
        vm.expectRevert(ArtVendor.ShareSumInvalid.selector);
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testListRevertZeroShare() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 0, 10000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.ZeroShare.selector);
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testListRevertZeroAddress() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(address(0), recip1, 5000, 5000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.ZeroAddress.selector);
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testListRevertArrayMismatch() public {
        address[] memory recips = new address[](2);
        recips[0] = recip0; recips[1] = recip1;
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10000;
        vm.prank(owner);
        vm.expectRevert(ArtVendor.ArrayLengthMismatch.selector);
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testListRevertStringWithQuote() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.InvalidString.selector);
        vendor.listArtwork(PRICE, EDITIONS, 'say "hello"', SERIES, recips, shares);
    }

    function testListRevertStringWithBackslash() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.InvalidString.selector);
        vendor.listArtwork(PRICE, EDITIONS, "path\\to\\file", SERIES, recips, shares);
    }

    function testListRevertStringTooLong() public {
        // 257 character string (> 256 byte limit for seedInput)
        // 257 A's:
        string memory longStr = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.StringTooLong.selector);
        vendor.listArtwork(PRICE, EDITIONS, longStr, SERIES, recips, shares);
    }

    // -----------------------------------------------------------------------
    // 1b. Successful listArtwork
    // -----------------------------------------------------------------------

    function testListArtwork_HappyPath() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        bytes32 expectedSeedHash = sha256(abi.encodePacked(SEED, "|v1|tallfenn"));
        vm.expectEmit(true, true, false, true, address(vendor));
        emit ArtVendor.ArtworkListed(0, owner, PRICE, EDITIONS, SERIES, expectedSeedHash);
        vm.prank(owner);
        uint256 id = vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
        assertEq(id, 0);
        assertEq(vendor.artworkCount(), 1);

        ArtVendor.Artwork memory art = vendor.artworks(0);
        assertEq(art.price, PRICE);
        assertEq(art.editions, EDITIONS);
        assertEq(art.sold, 0);
        assertEq(art.seedHash, expectedSeedHash);
        assertEq(art.seedInput, SEED);
        assertEq(art.seriesName, SERIES);
        assertEq(art.artist, owner);
    }

    // -----------------------------------------------------------------------
    // 2. Successful buy — balance splits
    // -----------------------------------------------------------------------

    function testBuyBalanceSplitTwoRecipients() public {
        // List with [8000, 2000]
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 8000, 2000);
        vm.prank(owner);
        uint256 artId = vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);

        uint256 aliceBefore = usdc.balanceOf(alice);

        // Contract emits: PayoutSent(recip0), PayoutSent(recip1), then ArtworkSold.
        // Expect PayoutSent for recip0
        vm.expectEmit(true, true, false, true, address(vendor));
        emit ArtVendor.PayoutSent(artId, recip0, 800_000);

        // Expect PayoutSent for recip1
        vm.expectEmit(true, true, false, true, address(vendor));
        emit ArtVendor.PayoutSent(artId, recip1, 200_000);

        // Expect ArtworkSold event (emitted last)
        vm.expectEmit(true, true, false, true, address(vendor));
        emit ArtVendor.ArtworkSold(artId, alice, 1, PRICE, 1);

        vm.prank(alice);
        vendor.buy(artId);

        // Buyer balance reduced
        assertEq(usdc.balanceOf(alice), aliceBefore - PRICE);

        // Recipients received correct amounts
        assertEq(usdc.balanceOf(recip0), 800_000);
        assertEq(usdc.balanceOf(recip1), 200_000);

        // Sold count
        assertEq(vendor.soldOf(artId), 1);

        // Receipt NFT minted to buyer (tokenId = 1 since _nextTokenId starts at 1)
        assertEq(vendor.ownerOf(1), alice);
    }

    function testBuyBalanceSplitRemainder() public {
        // price = 1_000_001; 8000 bps → 800_000 (floor), 2000 bps → 200_000 (floor)
        // distributed = 1_000_000, remainder = 1 → recip0 gets 800_001
        uint256 oddPrice = 1_000_001;
        usdc.mint(alice, 1); // ensure alice has enough for odd price

        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 8000, 2000);
        vm.prank(owner);
        uint256 artId = vendor.listArtwork(oddPrice, EDITIONS, SEED, SERIES, recips, shares);

        vm.prank(alice);
        vendor.buy(artId);

        // recip0 gets floor(1_000_001 * 8000 / 10000) + remainder = 800_000 + 1 = 800_001
        assertEq(usdc.balanceOf(recip0), 800_001);
        // recip1 gets floor(1_000_001 * 2000 / 10000) = 200_000
        assertEq(usdc.balanceOf(recip1), 200_000);
    }

    // -----------------------------------------------------------------------
    // 3. Last edition sold out
    // -----------------------------------------------------------------------

    function testLastEditionAndSoldOut() public {
        // List with 1 edition
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        uint256 artId = vendor.listArtwork(PRICE, 1, SEED, SERIES, recips, shares);

        // First buy succeeds
        vm.prank(alice);
        vendor.buy(artId);
        assertEq(vendor.soldOf(artId), 1);

        // Second buy reverts with EditionsSoldOut
        vm.prank(alice);
        vm.expectRevert(ArtVendor.EditionsSoldOut.selector);
        vendor.buy(artId);
    }

    // -----------------------------------------------------------------------
    // 4. tokenURI content
    // -----------------------------------------------------------------------

    function testTokenURIFields() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        string memory seedInput  = "Moonlit meadow with fireflies";
        string memory seriesName = "Meadow Series";

        vm.prank(owner);
        uint256 artId = vendor.listArtwork(PRICE, EDITIONS, seedInput, seriesName, recips, shares);

        vm.prank(alice);
        vendor.buy(artId);

        string memory uri = vendor.tokenURI(1);

        // Must start with the data URI prefix
        assertTrue(_startsWith(uri, "data:application/json;base64,"), "Missing data URI prefix");

        // Strip prefix and decode base64
        bytes memory encoded = bytes(uri);
        uint256 prefixLen = bytes("data:application/json;base64,").length;
        bytes memory b64data = new bytes(encoded.length - prefixLen);
        for (uint256 i = 0; i < b64data.length; i++) {
            b64data[i] = encoded[i + prefixLen];
        }
        string memory decoded = string(_base64Decode(b64data));

        // name contains seriesName and "#1"
        assertTrue(_contains(decoded, seriesName),     "name missing seriesName");
        assertTrue(_contains(decoded, "#1"),            "name missing #1");

        // description equals seedInput (it appears in the JSON as the description value)
        assertTrue(_contains(decoded, seedInput),       "description missing seedInput");

        // Edition attribute with value "1"
        assertTrue(_contains(decoded, '"trait_type":"Edition"'), "missing Edition trait_type");
        assertTrue(_contains(decoded, '"value":"1"'),            "missing edition value 1");

        // Series attribute with seriesName value
        assertTrue(_contains(decoded, '"trait_type":"Series"'),  "missing Series trait_type");

        // Artwork ID attribute with value "0"
        assertTrue(_contains(decoded, '"trait_type":"Artwork ID"'), "missing Artwork ID trait_type");
        assertTrue(_contains(decoded, '"value":"0"'),               "missing artwork id value 0");

        // image, animation_url, external_url present
        assertTrue(_contains(decoded, '"image":"'),         "missing image field");
        assertTrue(_contains(decoded, '"animation_url":"'), "missing animation_url field");
        assertTrue(_contains(decoded, '"external_url":"'),  "missing external_url field");
        assertTrue(_contains(decoded, APP_BASE),            "missing appBase in JSON");
        assertTrue(_contains(decoded, IMAGE_BASE),          "missing imageBase in JSON");
    }

    function testTokenURIImageAndAnimationFields() public {
        // Use a fixed seed so we can compute the expected seedHash deterministically.
        string memory seed = "masas|serie|A|01";
        string memory series = "Masas Serie A";
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);

        vm.prank(owner);
        vendor.listArtwork(PRICE, 1, seed, series, recips, shares);

        vm.prank(alice);
        vendor.buy(0);

        // Compute expected seedHash (same formula as contract)
        bytes32 expectedHash = sha256(abi.encodePacked(seed, "|v1|tallfenn"));
        string memory hashHex = _toHexStringNoPrefix(expectedHash);

        string memory uri = vendor.tokenURI(1);
        uint256 prefixLen = bytes("data:application/json;base64,").length;
        bytes memory encoded = bytes(uri);
        bytes memory b64data = new bytes(encoded.length - prefixLen);
        for (uint256 i = 0; i < b64data.length; i++) {
            b64data[i] = encoded[i + prefixLen];
        }
        string memory decoded = string(_base64Decode(b64data));

        // image = imageBase + hashHex + ".png"
        string memory expectedImage = string(abi.encodePacked(IMAGE_BASE, hashHex, ".png"));
        assertTrue(_contains(decoded, expectedImage), "image URL mismatch");

        // animation_url = appBase + "live?h=" + hashHex
        string memory expectedAnim = string(abi.encodePacked(APP_BASE, "live?h=", hashHex, "&e=1"));
        assertTrue(_contains(decoded, expectedAnim), "animation_url mismatch");

        // external_url = appBase
        string memory expectedExt = string(abi.encodePacked('"external_url":"', APP_BASE, '"'));
        assertTrue(_contains(decoded, expectedExt), "external_url mismatch");
    }

    // -----------------------------------------------------------------------
    // 5. Access control
    // -----------------------------------------------------------------------

    function testNonOwnerCannotList() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    function testNonOwnerCannotPause() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vendor.pause();
    }

    function testNonOwnerCannotUnpause() public {
        vm.prank(owner);
        vendor.pause();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vendor.unpause();
    }

    function testNonOwnerCannotUpdateRecipients() public {
        uint256 artId = _listDefault(EDITIONS);
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vendor.updateArtworkRecipients(artId, recips, shares);
    }

    // -----------------------------------------------------------------------
    // 6. Paused state
    // -----------------------------------------------------------------------

    function testPausedBlocksBuy() public {
        uint256 artId = _listDefault(EDITIONS);

        vm.prank(owner);
        vendor.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vendor.buy(artId);
    }

    function testPauseUnpauseCycle() public {
        uint256 artId = _listDefault(EDITIONS);

        vm.prank(owner);
        vendor.pause();

        // Buy blocked while paused
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vendor.buy(artId);

        // Owner unpauses
        vm.prank(owner);
        vendor.unpause();

        // Buy succeeds after unpause
        vm.prank(alice);
        vendor.buy(artId);
        assertEq(vendor.soldOf(artId), 1);
    }

    // -----------------------------------------------------------------------
    // 7. updateArtworkRecipients — brick & recovery
    // -----------------------------------------------------------------------

    function testBrickAndRecovery() public {
        // Deploy blocklist-aware USDC and a new ArtVendor that uses it.
        MockBlocklistableUSDC blUsdc = new MockBlocklistableUSDC();
        vm.prank(owner);
        ArtVendor blVendor = new ArtVendor(address(blUsdc), owner, IMAGE_BASE, APP_BASE);

        address goodAddr1 = makeAddr("goodAddr1");
        address goodAddr2 = makeAddr("goodAddr2");
        address badAddr   = makeAddr("badAddr");

        // Fund buyer and approve
        address buyer = makeAddr("buyer");
        blUsdc.mint(buyer, BUYER_SUPPLY);
        vm.prank(buyer);
        blUsdc.approve(address(blVendor), type(uint256).max);

        // List artwork with [goodAddr1, badAddr], 5000/5000, 3 editions so we can buy twice
        address[] memory recips0 = new address[](2);
        recips0[0] = goodAddr1;
        recips0[1] = badAddr;
        uint16[] memory shares0 = new uint16[](2);
        shares0[0] = 5000;
        shares0[1] = 5000;

        vm.prank(owner);
        uint256 artId = blVendor.listArtwork(PRICE, 3, SEED, SERIES, recips0, shares0);

        // Pre-condition: buy #1 succeeds while badAddr is not yet blocklisted
        vm.prank(buyer);
        blVendor.buy(artId);
        assertEq(blVendor.soldOf(artId), 1);

        // Blocklist badAddr
        blUsdc.addToBlocklist(badAddr);

        // Buy #2 should now revert because safeTransfer to badAddr reverts
        vm.prank(buyer);
        vm.expectRevert();
        blVendor.buy(artId);

        // Owner updates recipients — replaces badAddr with goodAddr2
        address[] memory newRecips = new address[](2);
        newRecips[0] = goodAddr1;
        newRecips[1] = goodAddr2;
        uint16[] memory newShares = new uint16[](2);
        newShares[0] = 5000;
        newShares[1] = 5000;

        // Expect the ArtworkRecipientsUpdated event
        vm.expectEmit(true, false, false, false, address(blVendor));
        emit ArtVendor.ArtworkRecipientsUpdated(artId, newRecips, newShares);

        vm.prank(owner);
        blVendor.updateArtworkRecipients(artId, newRecips, newShares);

        // Buy #2 now succeeds with good recipients
        uint256 good1Before = blUsdc.balanceOf(goodAddr1);
        uint256 good2Before = blUsdc.balanceOf(goodAddr2);

        vm.prank(buyer);
        blVendor.buy(artId);
        assertEq(blVendor.soldOf(artId), 2);

        // 5000/10000 * PRICE = 500_000 each
        assertEq(blUsdc.balanceOf(goodAddr1), good1Before + 500_000);
        assertEq(blUsdc.balanceOf(goodAddr2), good2Before + 500_000);
    }

    // -----------------------------------------------------------------------
    // 8. artworkNotFound guard
    // -----------------------------------------------------------------------

    function testBuyArtworkNotFound() public {
        vm.prank(alice);
        vm.expectRevert(ArtVendor.ArtworkNotFound.selector);
        vendor.buy(999);
    }

    function testArtworksGetterNotFound() public {
        vm.expectRevert(ArtVendor.ArtworkNotFound.selector);
        vendor.artworks(0);
    }

    function testSoldOfNotFound() public {
        vm.expectRevert(ArtVendor.ArtworkNotFound.selector);
        vendor.soldOf(0);
    }

    function testUpdateRecipientsNotFound() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        vm.expectRevert(ArtVendor.ArtworkNotFound.selector);
        vendor.updateArtworkRecipients(999, recips, shares);
    }

    // -----------------------------------------------------------------------
    // 9. ArtworkListed event on listArtwork
    // -----------------------------------------------------------------------

    function testListArtwork_EmitsArtworkListed() public {
        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        bytes32 expectedSeedHash = sha256(abi.encodePacked(SEED, "|v1|tallfenn"));

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(vendor));
        emit ArtVendor.ArtworkListed(0, owner, PRICE, EDITIONS, SERIES, expectedSeedHash);
        vendor.listArtwork(PRICE, EDITIONS, SEED, SERIES, recips, shares);
    }

    // -----------------------------------------------------------------------
    // 10. updateArtworkRecipients happy-path
    // -----------------------------------------------------------------------

    function testUpdateArtworkRecipients_HappyPath() public {
        uint256 artId = _listDefault(EDITIONS);

        address[] memory newRecips = new address[](2);
        newRecips[0] = recip2;
        newRecips[1] = recip3;
        uint16[] memory newShares = new uint16[](2);
        newShares[0] = 6000;
        newShares[1] = 4000;

        vm.prank(owner);
        vm.expectEmit(true, false, false, false, address(vendor));
        emit ArtVendor.ArtworkRecipientsUpdated(artId, newRecips, newShares);
        vendor.updateArtworkRecipients(artId, newRecips, newShares);

        // Buy and check new split is applied
        vm.prank(alice);
        vendor.buy(artId);

        assertEq(usdc.balanceOf(recip2), 600_000);
        assertEq(usdc.balanceOf(recip3), 400_000);
        // old recips should have nothing
        assertEq(usdc.balanceOf(recip0), 0);
        assertEq(usdc.balanceOf(recip1), 0);
    }

    // -----------------------------------------------------------------------
    // 11. Multiple artworks — artworkCount increments
    // -----------------------------------------------------------------------

    function testArtworkCountIncrements() public {
        assertEq(vendor.artworkCount(), 0);
        _listDefault(EDITIONS);
        assertEq(vendor.artworkCount(), 1);
        _listDefault(EDITIONS);
        assertEq(vendor.artworkCount(), 2);
    }

    // -----------------------------------------------------------------------
    // 12. Fuzz — buy any price, two equal recipients always get full payout
    // -----------------------------------------------------------------------

    function testFuzz_BuyFullPayout(uint128 fuzzPrice) public {
        // price must be at least 2 so each 50% share is ≥ 1
        uint256 price = bound(uint256(fuzzPrice), 2, type(uint64).max);

        usdc.mint(alice, price); // top up just in case
        vm.prank(alice);
        usdc.approve(address(vendor), type(uint256).max);

        (address[] memory recips, uint16[] memory shares) = _twoRecipients(recip0, recip1, 5000, 5000);
        vm.prank(owner);
        uint256 artId = vendor.listArtwork(price, 1, SEED, SERIES, recips, shares);

        uint256 aliceBefore  = usdc.balanceOf(alice);
        uint256 vendorBefore = usdc.balanceOf(address(vendor));

        vm.prank(alice);
        vendor.buy(artId);

        // Vendor must not retain any tokens (all distributed to recipients)
        assertEq(usdc.balanceOf(address(vendor)), vendorBefore, "vendor retained tokens");

        // Total paid out equals price (floor + remainder goes to recip0)
        uint256 r0Amount = price / 2 + (price - (price / 2) * 2); // remainder for equal split
        // For 5000 bps each: amount_i = price * 5000 / 10000 = price/2
        // remainder = price - 2*(price/2)  (0 when even, 1 when odd)
        uint256 expected0 = (price * 5000) / 10_000 + (price - 2 * ((price * 5000) / 10_000));
        uint256 expected1 = (price * 5000) / 10_000;
        assertEq(usdc.balanceOf(recip0), expected0);
        assertEq(usdc.balanceOf(recip1), expected1);
        assertEq(usdc.balanceOf(recip0) + usdc.balanceOf(recip1), price, "payout sum mismatch");

        // Alice paid exactly price
        assertEq(usdc.balanceOf(alice), aliceBefore - price, "alice paid wrong amount");
    }

    // -----------------------------------------------------------------------
    // Helpers — base64 decode + string utils (pure Solidity)
    // -----------------------------------------------------------------------

    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory sb = bytes(str);
        bytes memory pb = bytes(prefix);
        if (sb.length < pb.length) return false;
        for (uint256 i = 0; i < pb.length; i++) {
            if (sb[i] != pb[i]) return false;
        }
        return true;
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0) return true;
        if (h.length < n.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) { found = false; break; }
            }
            if (found) return true;
        }
        return false;
    }

    /// Mirrors _bytes32ToHexStringNoPrefix from the contract (no 0x prefix, 64 chars).
    function _toHexStringNoPrefix(bytes32 data) internal pure returns (string memory) {
        bytes16 hexSymbols = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(data[i]);
            str[i * 2]     = hexSymbols[b >> 4];
            str[i * 2 + 1] = hexSymbols[b & 0x0f];
        }
        return string(str);
    }

    /// Minimal base64 decoder (RFC 4648, no padding required).
    function _base64Decode(bytes memory data) internal pure returns (bytes memory) {
        // Build decode table
        bytes memory table = new bytes(128);
        // Uppercase A-Z = 0-25
        for (uint256 i = 0; i < 26; i++) table[65 + i] = bytes1(uint8(i));
        // Lowercase a-z = 26-51
        for (uint256 i = 0; i < 26; i++) table[97 + i] = bytes1(uint8(26 + i));
        // Digits 0-9 = 52-61
        for (uint256 i = 0; i < 10; i++) table[48 + i] = bytes1(uint8(52 + i));
        // + = 62, / = 63
        table[43] = bytes1(uint8(62));
        table[47] = bytes1(uint8(63));

        // Strip trailing '=' padding
        uint256 len = data.length;
        uint256 outputLen = (len / 4) * 3;
        if (len > 0 && data[len - 1] == '=') { outputLen--; len--; }
        if (len > 0 && data[len - 1] == '=') { outputLen--; len--; }

        bytes memory out = new bytes(outputLen);
        uint256 outIdx = 0;
        uint256 inIdx  = 0;
        while (inIdx + 3 < data.length) {
            uint256 a = uint8(table[uint8(data[inIdx])]);
            uint256 b = uint8(table[uint8(data[inIdx + 1])]);
            uint256 c = uint8(table[uint8(data[inIdx + 2])]);
            uint256 d = uint8(table[uint8(data[inIdx + 3])]);
            if (outIdx   < out.length) out[outIdx]   = bytes1(uint8((a << 2) | (b >> 4)));
            if (outIdx+1 < out.length) out[outIdx+1] = bytes1(uint8(((b & 0xF) << 4) | (c >> 2)));
            if (outIdx+2 < out.length) out[outIdx+2] = bytes1(uint8(((c & 0x3) << 6) | d));
            inIdx  += 4;
            outIdx += 3;
        }
        return out;
    }
}
