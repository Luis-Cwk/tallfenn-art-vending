# Tall Fenn Art Vending Machine

> Built with Arc Studio - money-powered apps in minutes

Generative-art vending machine for Petra (Luis Betancourt Nunez, CDMX). Buyers pay USDC; payment splits instantly to artist and collaborators; each purchase mints an ERC-721 receipt NFT with onchain metadata. Supports human and AI-agent buyers.

---

## What This App Does

`ArtVendor` is a Solidity contract (ERC-721 + Ownable + Pausable + SafeERC20) that:
- Lists artworks with price, editions, seedInput, seriesName, and up to 4 recipients with BPS shares
- Derives `seedHash` onchain: `sha256(abi.encodePacked(seedInput, "|v1|tallfenn"))`
- On `buy()`: pulls USDC from buyer, pushes split to each recipient, mints a receipt NFT with full onchain metadata (tokenURI returns a base64 JSON data URI)
- `updateArtworkRecipients()` lets the owner replace recipients (recovery path for blocklisted addresses)

## Deployed Contracts

| Contract | Address | Chain | Explorer |
|---|---|---|---|
| ArtVendor (canonical) | `0xced7cd9590b112da9149d29176b17630ed022266` | Arc Testnet | https://explorer.testnet.arc.io/address/0xced7cd9590b112da9149d29176b17630ed022266 |

Deploy tx: `0x5f366949e7ca840e26c31b862f12d4c2f1a1a30fc357444384e79daaa1aed57c`

Constructor args: `usdcToken=0x3600000000000000000000000000000000000000`, `initialOwner=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

## Token

- USDC ERC-20: `0x3600000000000000000000000000000000000000` on Arc Testnet
- **Decimals: 6** (confirmed via `decimals()` onchain). All contract prices in 6-decimal ERC-20 units.
- Note: Arc's native gas-token view uses 18 decimals for the same balance; the contract uses only the ERC-20 interface.

## Seeded Artworks

| ID | Series | seedInput | Editions | Price | Buy tx |
|---|---|---|---|---|---|
| 0 | Masas Semiredondas | `masas\|genesis\|001` | 25 | 500000 (0.5 USDC) | `0xe36283d9b15341ca769668a3cf4cd19974fb0d950092c913e5317d8d594a1cac` |
| 1 | Pruebas de bloqueo | `tallfenn\|bloqueo\|001` | 3 | 10000 (0.01 USDC) | recovery: `0x3253839ce370ef17c413a7ff29cdce29545c04ff6f6f3a8dab65f2be3f426bb3` |

See `NOTES.md` for full transaction details, blocklist demo results, and balance verification.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS; white-cube gallery aesthetic; EN/ES i18n (localStorage-persisted)
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. `via_ir = true`, `evm_version = "paris"`.
  - Source: `contracts/ArtVendor.sol`
  - Tests: `contracts/test/ArtVendor.t.sol` (35 tests, all passing)
  - Metadata: `contracts/contract-metadata/ArtVendor.json`
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC (6 decimals ERC-20, `0x3600000000000000000000000000000000000000`)

## Key Files

- `contracts/ArtVendor.sol`: Main contract
- `contracts/test/ArtVendor.t.sol`: Foundry unit tests
- `contracts/contract-metadata/ArtVendor.json`: Deployment metadata + ABI
- `scripts/seed-viem.ts`: Seeding + buy script
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
