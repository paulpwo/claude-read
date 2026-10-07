---
description: Read Claude's previous response aloud
argument-hint: "[faster | slower | 30% faster | más rápido | más lento] [which part to read]"
allowed-tools: mcp__leer__speak
---
Take the last response you gave before this command.

Arguments: "$ARGUMENTS"
- Speed: pick RATE from the arguments, else +0%.
  - "faster" / "más rápido" / "rápido" → +25%; "much faster" / "mucho más rápido" → +50%
  - "slower" / "más lento" / "lento" → -20%; "much slower" / "mucho más lento" → -35%
  - An explicit percentage wins: "30% faster" / "30% más rápido" → +30%, "20% slower" / "20% más lento" → -20%
  - Clamp RATE to the range -50% to +100%.
- Anything else in the arguments describes which part to read; read only that part. No such words → read it all.

Clean it for speech: remove code blocks, file paths, URLs and markdown symbols (#, *, `, |, >, -). Keep it natural prose in the response's own language. Max 3000 characters; truncate at a sentence boundary if longer.

Make exactly one call to the `mcp__leer__speak` tool with `text` set to the cleaned text and `rate` set to RATE (always signed, e.g. "+0%", "+25%", "-20%").

Do not add commentary before or after; only make the call.
