---
date: 2026-02-13
tags: skill, briefing, audio, tts, 11labs
---

# 🔊 Audio Briefing Skill

> *Convert text briefings to audio and send both files*

## Purpose

Convert a text briefing into audio format and deliver both files:
1. **MP3 audio** — For listening on-the-go
2. **Text file** — For reference and search

## Trigger

User says: **"Send audio briefing"** or **"Convert to audio"**

## Workflow

### Step 1: Get Text Briefing

Either:
- Receive text briefing from Text Briefing skill
- Or read existing briefing file from workspace

### Step 2: Optimize for TTS (Critical)

**Convert natural text to TTS-friendly format:**

**REMOVE:**
- `#` headers — convert to plain text
- `-` bullets — convert to sentences or paragraphs
- `*` emphasis markers
- `[links]` — remove brackets, keep text
- URLs — write as "example dot com"
- `%` — write as "percent" (TTS handles this)
- Numbers — keep as digits (TTS reads correctly)
- Emojis — remove entirely

**CONVERT:**
```
# Header → Header
colon slash slash → dot
- Bullet point → Bullet point or just the text
[Link text](url) → Link text
40% → 40 percent
$100 → 100 dollars
```

**Example Transformation:**

**Input (natural text):**
```
# CRM Research Briefing

## Key Points
- Clay.com: Data enrichment + AI
- Pipedrive: Visual pipeline
- 40% no-show reduction
```

**Output (TTS-optimized):**
```
CRM Research Briefing.

Key Points.
Clay dot com. Data enrichment and AI.
Pipedrive. Visual pipeline.
40 percent no-show reduction.
```

### Step 3: Generate Audio

**TTS Settings:**
- **Voice:** Nova (warm, conversational)
- **Model:** eleven turbo v2.5
- **Speed:** 1.15x (slightly faster for briefings)

Generate audio via TTS tool.

### Step 4: Send Both Files

**Send to Telegram:**
1. **MP3 audio** — Primary delivery
2. **Text file** — Reference (send immediately after audio)

**Message format:**
```
🎙️ [Topic] Briefing

[Audio file]

📄 Text version attached for reference
```

### Step 5: Cleanup

Delete both files from workspace after sending.

## TTS Optimization Rules

### Headers
```
# Title → Title.
## Section → Section.
### Subsection → Subsection.
```

### Bullets and Lists
```
- Item 1 → Item 1.
- Item 2 → Item 2.
1. First → First.
2. Second → Second.
```

### Links and URLs
```
[text](url) → text
colon slash slash → dot
https://example.com → example dot com
```

### Symbols
```
% → percent
$ → dollars
& → and
/ → slash or divide
@ → at
# → number or hash
→ → leads to or to
• → dash or bullet
```

### Numbers
- Keep as digits: 40, 100, 2026
- TTS reads correctly: "forty", "one hundred", "two thousand twenty-six"

### Abbreviations
```
CRM → C R M or Customer Relationship Management (first time)
API → A P I
AI → A I
TTS → text to speech
```

### Emojis
- Remove all emojis
- Replace with nothing or word if meaningful

## Complete Example

**Natural Text Input:**
```
# CRM Research — February 13

I analyzed **Clay**, *Pipedrive*, and [HubSpot](https://hubspot.com).

## Key Findings
- 40% no-show reduction with reminders
- $15-100/user for Pipedrive
- CRM + AI = 🔥
```

**TTS-Optimized Output:**
```
CRM Research. February 13.

I analyzed Clay, Pipedrive, and HubSpot.

Key Findings.
40 percent no-show reduction with reminders.
15 to 100 dollars per user for Pipedrive.
CRM plus AI equals powerful combination.
```

## Speed Setting

**Default: 1.15x speed**

Why faster?
- Briefings are information-dense
- Users want to consume quickly
- 1.15x is still natural, just more efficient

**Adjust if needed:**
- User prefers normal: 1.0x
- User wants faster: 1.25x (max)

## Delivery Rules

### Always Send Both
1. **Audio first** — Primary consumption
2. **Text immediately after** — Reference and search

### Why Both?
- **Audio:** Listen while driving, walking, doing other tasks
- **Text:** Search for specific details, copy-paste, reference later

### Target
Send to the source of the request:
- Group request → Send to group
- DM request → Ask where to send, default to DM

## Error Handling

**TTS Generation Fails:**
- Log error
- Send text file only
- Notify: "Audio generation failed. Text version attached."

**Audio Upload Fails:**
- Retry once
- If still fails, send text only
- Log error

**File Too Large:**
- Split into multiple briefings
- Or send text only

## Integration

**Input:** Text briefing (from Text Briefing skill or file)
**Output:** MP3 + TXT files sent to Telegram
**Cleanup:** Delete workspace files after sending

**Related Skills:**
- [[mind/skills/briefing/text-briefing|Text Briefing]] — Create the text
- [[mind/skills/briefing|Briefing Hub]] — Overview of all briefing skills

---

*Audio Briefing: Convert text to audio, send both, cleanup after.*
