/**
 * Deploy ArtVendor v4 to Arc mainnet + list the launch works.
 *
 * Compiles contracts/ArtVendor.sol locally with solc-js (Studio not needed),
 * deploys with viem and registers the three launch artworks:
 *   #0 masas|genesis|001  0.5 USDC x 25   (entry)
 *   #1 masas|premium|003  2.0 USDC x 5    (agent mints edition 1)
 *   #2 masas|premium|011  5.0 USDC x 3
 *
 * Usage: node scripts/deploy-v4.mjs [--list-only 0xADDRESS]
 * Writes contracts/contract-metadata/ArtVendor.mainnet.v4.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '..')
const SECRETS = 'C:/Users/petra/.arc-studio-secrets/arc-mainnet-wallet.json'

const RPC = process.env.RPC_URL ?? 'https://rpc.mainnet.arc.io'
const CHAIN = {
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
}
const USDC = '0x3600000000000000000000000000000000000000'
const IMAGE_BASE = 'https://tallfenn-art-vending.petrasynthetic.workers.dev/posters/'
const APP_BASE = 'https://tallfenn-art-vending.petrasynthetic.workers.dev/'
const RECIPIENTS = ['0x53360033F25E9468FF792ff1f25A8F8B45c523b7', '0x1A49138cCb61C50D72A44a299F6C74c690f6c67f']
const SHARES = [8000, 2000]
const GAS = { maxFeePerGas: 60n * 10n ** 9n, maxPriorityFeePerGas: 1n * 10n ** 9n }

const WORKS = [
  { seedInput: 'masas|genesis|001', seriesName: 'Masas Semiredondas', price: 500_000n, editions: 25 },
  { seedInput: 'masas|premium|003', seriesName: 'Masas Semiredondas', price: 2_000_000n, editions: 5 },
  { seedInput: 'masas|premium|011', seriesName: 'Masas Semiredondas', price: 5_000_000n, editions: 3 },
]

const seedHashOf = (seedInput) => createHash('sha256').update(`${seedInput}|v1|tallfenn`).digest('hex')

function compile() {
  const solc = require('solc')
  const source = readFileSync(resolve(APP, 'contracts/ArtVendor.sol'), 'utf8')
  const input = {
    language: 'Solidity',
    sources: { 'ArtVendor.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  }
  const findImports = (path) => {
    for (const base of [resolve(APP, 'node_modules'), resolve(APP, 'contracts')]) {
      const full = resolve(base, path)
      if (existsSync(full)) return { contents: readFileSync(full, 'utf8') }
    }
    return { error: 'not found: ' + path }
  }
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))
  const errors = (out.errors ?? []).filter((e) => e.severity === 'error')
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage)
    throw new Error('solc failed')
  }
  const artifact = out.contracts['ArtVendor.sol'].ArtVendor
  console.log('compiled: bytecode', artifact.evm.bytecode.object.length / 2, 'bytes')
  return artifact
}

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)

const wallet = JSON.parse(readFileSync(SECRETS, 'utf8'))
const account = privateKeyToAccount(wallet.privateKey)
const pub = createPublicClient({ chain: CHAIN, transport: http(RPC) })
const cli = createWalletClient({ account, chain: CHAIN, transport: http(RPC) })

const vendorAbi = parseAbi([
  'function listArtwork(uint256 price, uint32 editions, string seedInput, string seriesName, address[] recipients, uint16[] sharesBps) returns (uint256)',
  'function artworkCount() view returns (uint256)',
  'function artworks(uint256) view returns ((address artist, uint256 price, uint32 editions, uint32 sold, string seedInput, bytes32 seedHash, string seriesName, address[] recipients, uint16[] sharesBps))',
])

const listOnly = process.argv.indexOf('--list-only')
let address
let artifact = null
let deployTx = null
let deployBlock = null

if (process.argv.includes('--compile-only')) {
  compile()
  process.exit(0)
}

if (listOnly !== -1) {
  address = process.argv[listOnly + 1]
  if (!address?.startsWith('0x')) throw new Error('usage: node scripts/deploy-v4.mjs --list-only 0xADDRESS')
  console.log('using existing contract', address)
} else {
  artifact = compile()
  const balance = await pub.getBalance({ address: account.address })
  console.log('deployer', account.address, 'balance', formatUnits(balance, 18), 'USDC (native)')

  const deployHash = await cli.deployContract({
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
    args: [USDC, account.address, IMAGE_BASE, APP_BASE],
    gas: 4_500_000n,
    ...GAS,
  })
  console.log('deploy tx', deployHash)
  const rc = await pub.waitForTransactionReceipt({ hash: deployHash })
  if (rc.status !== 'success') throw new Error('deploy reverted')
  address = rc.contractAddress
  deployTx = deployHash
  deployBlock = Number(rc.blockNumber)
  console.log('deployed v4 at', address, 'block', deployBlock)
}

// --- list works ---
const count = await pub.readContract({ address, abi: vendorAbi, functionName: 'artworkCount' })
const listTxs = {}
console.log('artworks already listed:', count.toString())

for (let i = Number(count); i < WORKS.length; i++) {
  const w = WORKS[i]
  const hash = await cli.writeContract({
    address,
    abi: vendorAbi,
    functionName: 'listArtwork',
    args: [w.price, w.editions, w.seedInput, w.seriesName, RECIPIENTS, SHARES],
    gas: 600_000n,
    ...GAS,
  })
  const rc = await pub.waitForTransactionReceipt({ hash })
  if (rc.status !== 'success') throw new Error('listArtwork reverted for ' + w.seedInput)
  listTxs[w.seedInput] = hash
  console.log(`listed #${i} ${w.seedInput} ${formatUnits(w.price, 6)} USDC x ${w.editions} tx ${hash}`)
}

const record = {
  version: 4,
  network: 'arc-mainnet',
  chainId: 5042,
  address,
  deployTx,
  deployBlock,
  listTxs,
  usdc: USDC,
  imageBase: IMAGE_BASE,
  appBase: APP_BASE,
  owner: account.address,
  works: WORKS.map((w, id) => ({
    id,
    seedInput: w.seedInput,
    seedHash: '0x' + seedHashOf(w.seedInput),
    price: w.price.toString(),
    editions: w.editions,
  })),
  createdAt: new Date().toISOString(),
}
const outPath = resolve(APP, 'contracts/contract-metadata/ArtVendor.mainnet.v4.json')
writeFileSync(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8')
console.log('wrote', outPath)
for (const w of record.works) console.log('seed', w.seedInput, 'poster', `${IMAGE_BASE}${w.seedHash.slice(2)}.png`)
