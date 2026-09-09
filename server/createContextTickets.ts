import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto"
import { ResearchError } from "./ResearchError.ts"

/** Encrypt and authenticate transient context so precise locations never appear in URLs or readable tokens. */
export function createContextTickets(
  /** At least 32 characters of server-only secret material. */
  secret: string,
  /** Injectable clock. */
  now: () => Date,
) {
  if (secret.length < 32) throw new ResearchError("unavailable")
  const key = createHash("sha256").update(secret).digest()
  return {
    /** Seal bounded context with a one-day expiry. */
    seal(value: unknown) {
      const nonce = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, nonce)
      const bytes = Buffer.from(JSON.stringify({ expires: now().getTime() + 86_400_000, value }))
      const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()])
      return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url")
    },
    /** Open only authentic, unexpired context. */
    open(ticket: string): unknown {
      try {
        if (!/^[A-Za-z0-9_-]+$/.test(ticket) || ticket.length > 40_000) throw new Error()
        const bytes = Buffer.from(ticket, "base64url")
        const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12))
        decipher.setAuthTag(bytes.subarray(12, 28))
        const json = JSON.parse(
          Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString(),
        )
        if (!Number.isFinite(json.expires) || json.expires <= now().getTime()) throw new Error()
        return json.value
      } catch {
        throw new ResearchError("expired")
      }
    },
    /** Derive a stable UUID for safely replaying one operation and its radius steps. */
    jobId(value: unknown) {
      const bytes = createHmac("sha256", key).update(JSON.stringify(value)).digest().subarray(0, 16)
      bytes[6] = (bytes[6]! & 0x0f) | 0x40
      bytes[8] = (bytes[8]! & 0x3f) | 0x80
      const hex = bytes.toString("hex")
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    },
  }
}
