import { ResearchError } from "./ResearchError.ts"
import type { ResearchErrorCode } from "../src/research/contracts.ts"

/** Read a stream with a real byte cap, including chunked bodies without Content-Length. */
export async function readBoundedBody(
  /** HTTP request or response. */
  message: Request | Response,
  /** Maximum decoded body bytes. */
  maximum: number,
  /** Failure classification appropriate to this boundary. */
  code: ResearchErrorCode,
): Promise<Uint8Array> {
  if (Number(message.headers.get("content-length")) > maximum) throw new ResearchError(code)
  const reader = message.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > maximum) {
        await reader.cancel()
        throw new ResearchError(code)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof ResearchError) throw error
    throw new ResearchError(code)
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
