# DoraHacks submission draft (Arc Microgrants: Built with Arc Studio)

## Project name

Tall Fenn: Art Vending Machine

## One-liner

A generative art vending machine on Arc: pay in USDC, get an onchain edition receipt, and the payment splits itself between the artist and collaborators. Humans and AI agents buy the same way.

## Description

Tall Fenn is a small gallery with a vending machine inside. Each artwork is a generative piece born from a seed string stored onchain: the browser hashes the seed and renders the work deterministically, so the same seed always produces the same image on any device. Two engines ship with the app: a WebGL shader engine ("Masas semiredondas") and a deterministic SVG engine.

The shader engine has two collections. The study collection improvises with mode, palette, density and choreography. The premium collection renders an orbital sculpture: bodies orbit a central mass, lit by two directions of light, with double fresnel, veins of light, travelling bands and suspended dust; the piece can be orbited with the mouse. Every artwork, and every single edition inside it, derives its own variant from the seed, so two editions of the same work are never the same image.

Buying is one transaction. `buy(artworkId)` pulls exactly the price in USDC and forwards each recipient's share immediately (up to four recipients, basis points), then mints an edition receipt whose onchain metadata carries the series, the seed hash, a poster image and a link to the live piece (`animation_url`, unique per edition). There is no intermediary and no custody. Buyers can be humans or AI agents; the contract does not distinguish.

An AI agent minted the first edition of the premium collection on Arc mainnet: it read the contract, approved USDC and bought edition one with no human in the loop. The repository ships the script (`scripts/agent-buy.mjs`) and `llms.txt` documents the whole flow for machines.

The app was built end to end in Arc Studio: contract, tests and frontend. Contract behaviour was reviewed and covered by 35 Foundry tests, including a recovery path for blocklisted payout addresses (verified on Arc testnet with the documented blocklisted test address). The frontend is a white-cube gallery in English and Spanish, with live rendering, a seed study page with both collections, a splits ledger read from `PayoutSent` events, and an artist panel for listing works and updating recipients.

## Links

- Live app: https://tallfenn-art-vending.petrasynthetic.workers.dev
- Repository: https://github.com/Luis-Cwk/tallfenn-art-vending
- Contract (Arc mainnet, v4): https://explorer.arc.io/address/0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0
- Deploy tx: https://explorer.arc.io/tx/0x9c7fcc5590196dbfe835aec9c70ff8ef649a1a627254322c2412a38d87536910
- Agent buy tx (edition 1 of masas|premium|003, 2 USDC, 80/20 split): https://explorer.arc.io/tx/0x2022eb85cacffb84b9f6f61f0b2ffeb9813d69a33bf9ef6d5d59ccba100641a3
- Receipt token page: https://explorer.arc.io/token/0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0
- Agent guide: https://tallfenn-art-vending.petrasynthetic.workers.dev/llms.txt
- Arc Studio project: https://studio.arc.io/app/b65c7764-ac57-4914-ab49-035ed4bc1491

## What's next

Add a dedicated page per artwork, open the vending machine to agent buyers with an x402 endpoint so services can purchase without a human in the loop, and move the app to petrasynthetic.com with its own domain.

## Notes for the form

- Tracks: software-to-software payments, payment splitting, AI agent buyers.
- The mainnet transactions above move real USDC through the contract and the app.
- Everything in the repo builds with `npm install --legacy-peer-deps && npm run dev` (frontend) and `forge build && forge test` (contracts).
