import { encode, decode } from "https://esm.sh/gpt-tokenizer@2.1.1"

// Helper function to count tokens accurately using gpt-tokenizer
export function countTokens(text: string): number {
  return encode(text).length
}

// Helper function to truncate text to keep the last N tokens
export function truncateToLastTokens(text: string, maxTokens: number): string {
  const tokens = encode(text)

  if (tokens.length <= maxTokens) {
    console.log(`📊 INFO: Text is ${tokens.length} tokens, no truncation needed`)
    return text
  }

  // Keep last N tokens
  const truncatedTokens = tokens.slice(-maxTokens)
  const truncatedText = decode(truncatedTokens)

  console.log(`📊 INFO: Truncated text from ${tokens.length} tokens to ${maxTokens} tokens (${truncatedText.length} chars)`)
  return truncatedText
}
