# Tall Fenn Art Vending Machine

> Built with Arc Studio - money-powered apps in minutes

Generative-art vending machine for Tall Fenn. Buyers pay USDC; payment splits instantly to artist and collaborators; each purchase mints an ERC-721 receipt NFT with onchain metadata. Supports human and AI-agent buyers.

---

## What This App Does

`ArtVendor` is a Solidity contract (ERC-721 + Ownable + Pausable + SafeERC20) that:
- Lists artworks with price, editions, seedInput, seriesName, and up to 4 recipients with BPS shares
- Derives `seedHash` onchain: `sha256(abi.encodePacked(seedInput, "|v1|tallfenn"))`
- On `buy()`: pulls USDC from buyer, pushes split to each recipient, mints a receipt NFT with full onchain metadata (tokenURI returns a base64 JSON data URI)
- `updateArtworkRecipients()` lets the owner replace recipients (recovery path for blocklisted addresses)

## Deployed Contracts

### Arc mainnet (active)

| Contract | Address | Chain | Explorer |
|---|---|---|---|
| ArtVendor (canonical) | `0xa750869cf87ac1d001a70bdfd1d75de468014153` | Arc (5042) | https://explorer.arc.io/address/0xa750869cf87ac1d001a70bdfd1d75de468014153 |

Deploy tx: `0xa2d3f4ad662bb24c78d5c84d78b2c4b26badec9f1495d3845e5aaaa97a3ee8e1`
Deploy block: `26394991`

Constructor args: `usdcToken=0x3600000000000000000000000000000000000000`, `initialOwner=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

Buy tx (0.5 USDC, 80/20 split, second recipient received 0.1 USDC): `0xd0ff393bf417ed7bcf698490f0bda2e20a979d1ed8bd2a56c89d192f0e96bcc3`

### Arc Testnet (historical, inactive)

| Contract | Address | Chain | Explorer |
|---|---|---|---|
| ArtVendor (testnet) | `0xced7cd9590b112da9149d29176b17630ed022266` | Arc Testnet (5042002) | https://explorer.testnet.arc.io/address/0xced7cd9590b112da9149d29176b17630ed022266 |

Testnet deploy tx: `0x5f366949e7ca840e26c31b862f12d4c2f1a1a30fc357444384e79daaa1aed57c`

## Token

- USDC ERC-20: `0x3600000000000000000000000000000000000000` on Arc mainnet
- **Decimals: 6** (confirmed via `decimals()` onchain). All contract prices in 6-decimal ERC-20 units.
- Note: Arc's native gas-token view uses 18 decimals for the same balance; the contract uses only the ERC-20 interface.

## Seeded Artworks (Arc mainnet)

| ID | Series | seedInput | Editions | Price |
|---|---|---|---|---|
| 0 | Masas Semiredondas | `masas\|genesis\|001` | 25 | 500000 (0.5 USDC) |

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS; white-cube gallery aesthetic; EN/ES i18n (localStorage-persisted)
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. `via_ir = true`, `evm_version = "paris"`.
  - Source: `contracts/ArtVendor.sol`
  - Tests: `contracts/test/ArtVendor.t.sol` (35 tests, all passing)
  - Metadata: `contracts/contract-metadata/ArtVendor.json`
- Chain: Arc mainnet (Chain ID: 5042)
- Token: USDC (6 decimals ERC-20, `0x3600000000000000000000000000000000000000`)

## Key Files

- `contracts/ArtVendor.sol`: Main contract
- `contracts/test/ArtVendor.t.sol`: Foundry unit tests
- `contracts/contract-metadata/ArtVendor.json`: Deployment metadata + ABI
- `scripts/seed-viem.ts`: Seeding + buy script (used on testnet; adapt for mainnet)
- `NOTES.md`: Full deployment notes, tx hashes, explorer URLs

## Art Semantics (from context/art.ts)

- Series lines: "Cuerpos", "Fase REM de una IA", "Atractor", "Kinetics of Bodies", "SOMA", "Masas Semiredondas", "Pruebas de bloqueo"
- Seed formula: `sha256(seedInput + "|v1|tallfenn")`, derived onchain in the contract
- Palette: 5 HSL colors from hash bytes; noiseSeed, motion, motionGrammar all deterministic from hash
- No onchain SVG image; frontend renders from seedHash + palette (see context/art.ts `buildSvgPreview`)

## To Run

```bash
bun install
bun run dev
```

## Contract Commands

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test
```
