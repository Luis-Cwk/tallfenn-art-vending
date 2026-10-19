# Video walkthrough (2 minutes)

Record with OBS at 1080p, 30 fps. Narration in English if you can; Spanish with English subtitles also works.
Keep it under 2:10. Do not show wallet balances, private keys or emails.

## 0:00 - 0:08  Opening

Show the live app gallery with the premium piece moving:
https://tallfenn-art-vending.petrasynthetic.workers.dev

Say: "This is Tall Fenn, a generative art vending machine on Arc. Buyers pay in USDC, and every sale splits automatically."

## 0:08 - 0:30  Arc Studio (Petra's session)

Open your Arc Studio project:
https://studio.arc.io/app/b65c7764-ac57-4914-ab49-035ed4bc1491

Show, in this order: the chat history where the contract was built, the file tree (contracts/ArtVendor.sol, contracts/test, src/), and the preview panel.

Say: "Everything here was built in Arc Studio: the ArtVendor contract, its 35 Foundry tests, and the frontend. Studio generated and tested the contracts; the same artifact was deployed to Arc mainnet."

## 0:30 - 0:55  The work

Back to the live app. In the catalogue pick masas|premium|003, then drag inside the frame to orbit the sculpture. Point at the museum label and at the minted editions list below it.

Say: "Each artwork is born from a seed string stored onchain. The browser hashes it and renders deterministically, so the same seed always produces the same piece. This is Masas semiredondas, the premium collection: an orbital sculpture with two directions of light, veins of light and suspended dust. You can orbit it with the mouse. The list below reads every minted edition straight from the chain."

Show the Seeds page for a second: the premium grid and the study grid side by side.

## 0:55 - 1:25  The payment (mainnet)

First show the agent purchase: open the agent mint transaction on the explorer
https://explorer.arc.io/tx/0x2022eb85cacffb84b9f6f61f0b2ffeb9813d69a33bf9ef6d5d59ccba100641a3

Say: "This first edition was minted by an AI agent. It read the contract, approved USDC and bought edition one without a human in the loop. The repo ships the script: scripts/agent-buy.mjs, and llms.txt documents the flow for machines."

Option A (preferred): record your own buy in the app with your wallet (edition 2 of masas|premium|003, 2.00 USDC).
Option B: open your receipt transaction on the explorer.

Then open the receipt token page (it shows the image and the live view):
https://explorer.arc.io/token/0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0

Say: "A buy pulls exactly the price in USDC and splits it instantly: 80 percent to the artist wallet, 20 percent to the collaborator. It also mints an onchain receipt whose metadata carries the seed hash, the poster image and a link to the live piece."

## 1:25 - 1:50  Splits

Open the Splits tab. The table shows the payouts of the premium sales (1.60 USDC and 0.40 USDC per 2.00 USDC sale).

Say: "This ledger reads the payout events straight from the chain. No intermediary, no custody."

## 1:50 - 2:00  Closing

Show the contract address and the repo:
https://github.com/Luis-Cwk/tallfenn-art-vending

Say: "Contract 0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0 on Arc mainnet. Code on GitHub. Built with Arc Studio."

## Upload

YouTube, visibility "Unlisted". Title: "Tall Fenn: Art Vending Machine on Arc (demo)".
Then paste the link to Petra's agent so it can complete the DoraHacks submission.
