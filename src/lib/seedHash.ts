/** sha256 helpers: same formula as the contract: sha256(seedInput + "|v1|tallfenn") */

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function computeSeedHashInput(seedInput: string): string {
  return `${seedInput}|v1|tallfenn`
}

/** Verify browser-computed hash against the onchain bytes32 seedHash (0x-prefixed hex). */
export async function verifySeedHash(seedInput: string, onchainHash: string): Promise<boolean> {
  const computed = await sha256Hex(computeSeedHashInput(seedInput))
  // onchainHash is a 0x-prefixed 32-byte hex (66 chars); drop 0x for comparison
  const normalized = onchainHash.startsWith('0x') ? onchainHash.slice(2) : onchainHash
  return computed.toLowerCase() === normalized.toLowerCase()
}

export function byteAt(hex: string, i: number): number {
  return parseInt(hex.slice(i * 2, i * 2 + 2) || '0', 16)
}

export function isMasasSeed(seedInput: string): boolean {
  return seedInput.startsWith('masas|')
}

/** Premium seeds: orbital sculpture + luxury palettes. */
export function isPremiumSeed(seedInput: string): boolean {
  return seedInput.startsWith('masas|premium|')
}
