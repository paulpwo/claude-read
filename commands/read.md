---
description: Read Claude's previous response aloud
argument-hint: "[faster | slower | 30% faster | más rápido | ...] [which part: \"the summary\", \"solo la conclusión\", ...]"
allowed-tools: mcp__read__speak
---
Take the last response you gave before this command.

Arguments: "$ARGUMENTS"

The arguments may be in any language (English, Spanish, Portuguese, ...). Interpret them by meaning, not by exact words.

- Speed: pick RATE from the arguments, else +0%.
  - "faster" (e.g. "faster", "más rápido", "rápido", "mais rápido") → +25%; "much faster" ("mucho más rápido") → +50%
  - "slower" (e.g. "slower", "más lento", "lento", "mais devagar") → -20%; "much slower" ("mucho más lento") → -35%
  - An explicit percentage wins: "30% faster" / "30% más rápido" → +30%, "20% slower" / "20% más lento" → -20%
  - Clamp RATE to the range -50% to +100%.
- Anything else describes which part to read ("the summary", "only the second point", "solo la conclusión"); read only that part. Words that only say "read" ("read", "read this", "leer", "leer esto", "léelo") with nothing more mean the whole response. No such words → read it all.

Clean it for speech: remove code blocks, file paths, URLs and markdown symbols (#, *, `, |, >, -). Keep it natural prose in the response's own language. Max 3000 characters; truncate at a sentence boundary if longer.

Make exactly one call to the `mcp__read__speak` tool with `text` set to the cleaned text and `rate` set to RATE (always signed, e.g. "+0%", "+25%", "-20%").

Do not add commentary before or after; only make the call.
