# Research: Backslash Preservation in AI-Generated Summaries

## Problem
When gpt-4o-mini generates summaries mentioning PostgreSQL psql meta-commands (like `\dRp+`, `\dt`, `\d`), the backslashes are lost in the final stored text. The backtick wrapping works fine for regular identifiers.

## Root Cause Analysis

### What's NOT the problem:
- ❌ Frontend markdown rendering (fixed — using simple regex now, not `marked`)
- ❌ JSON.parse in edge function (we added a fix for invalid JSON escapes)
- ❌ Database storage (stores whatever it receives faithfully)

### What IS the problem:
The **model itself** omits backslashes from its JSON output. When asked to write a JSON string containing `\dRp+`, it either:
1. Writes `\dRp+` (invalid JSON escape, backslash gets eaten by JSON.parse)
2. Writes `dRp+` (omits the backslash entirely)
3. Rarely: writes `\\dRp+` (correct, but unreliable)

Even with explicit prompt instructions ("use double backslashes in JSON"), the model inconsistently follows this for backslash-prefixed terms. This is a known weakness of LLMs generating JSON with escape characters.

## Solutions (in order of reliability)

### Option 1: Post-processing (RECOMMENDED)
After JSON.parse, scan the summary text and cross-reference with the original thread subject. If the subject contains `\d` commands, ensure they appear correctly in the summary.

```typescript
// After parsing, restore backslashes for known psql meta-commands
function restoreBackslashes(summary: string, subject: string): string {
  // Extract psql meta-commands from subject (e.g., \dRp+, \dt, \d)
  const metaCmds = subject.match(/\\d\w*/g) || [];
  for (const cmd of metaCmds) {
    // cmd is e.g. "\dRp" — find instances missing the backslash
    const withoutBackslash = cmd.slice(1); // "dRp"
    // Replace `dRp` with `\dRp` when inside backticks
    summary = summary.replace(new RegExp('`' + withoutBackslash, 'g'), '`' + cmd);
  }
  return summary;
}
```

### Option 2: Two-pass generation
1. First pass: generate summary normally (JSON mode)
2. Second pass: ask model to review and fix any missing backslashes (text mode, not JSON)

Too expensive (doubles API calls) and still unreliable.

### Option 3: Switch away from JSON response format
Use plain text output with delimiter markers instead of JSON, then parse manually. Avoids the JSON escape issue entirely but adds parsing complexity.

### Option 4: Use a smarter model (e.g. gpt-4o)
More expensive. Might be slightly better at escape sequences but not guaranteed.

## Recommendation
Go with **Option 1** — post-processing. It's deterministic, costs nothing, and handles the specific case perfectly. The backslash commands come from the thread subject (which we have), so we can always cross-reference.

## Status
- Prompt updated to request backticks ✅
- Prompt updated to request backslash preservation ✅ (model doesn't reliably follow)
- JSON escape fix in place ✅ (catches case 1 above)
- Post-processing fix: **TODO** (will fix case 2 — model omitting backslash entirely)
