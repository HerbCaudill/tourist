import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

/** Own the complete generation request shared by discovery, chat, and latency measurements. */
export async function createModelRequest(
  /** Application prompt and bounded context. */
  prompt: string,
) {
  return {
    model: "gpt-6-astra",
    reasoning: { effort: "low" },
    instructions: await readFile(resolve("server/prompts/system.prompt.md"), "utf8"),
    input: prompt,
    tools: [],
    store: false,
    service_tier: "default",
    max_output_tokens: 6000,
  }
}
