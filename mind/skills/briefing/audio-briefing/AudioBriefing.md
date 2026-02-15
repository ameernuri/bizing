---
date: 2026-02-13
tags: 
  - skill
  - briefing
  - audio
  - tts
  - 11labs
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
- `[links]` — remove brackets
  - keep text
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
- **Speed:** 1.5x (Ameer's preference for faster consumption)

Generate audio via TTS tool.

### Step 4: Send Both Files

**Send to Telegram - USE MEDIA PARAMETER:**

1. **First audio:** Send as media attachment
2. **Subsequent audios:** Send each as separate media attachments
3. **Text file:** Reference message after all audios

**❌ WRONG (what I did):**
```
Here's the audio: /path/to/file.mp3
```
This sends text, not audio.

**✅ RIGHT (correct way):**
```javascript
// Send audio as media
message({
  action: "send",
  channel: "telegram",
  media: "/path/to/audio.mp3"
})
```

**Example workflow for multi-part briefing:**
```javascript
// Part 1
message({
  action: "send",
  channel: "telegram",
  media: "/path/to/part1.mp3"
})

// Part 2
message({
  action: "send",
  channel: "telegram",
  media: "/path/to/part2.mp3"
})

// Part 3
message({
  action: "send",
  channel: "telegram",
  media: "/path/to/part3.mp3"
})
```

**Message format:**
```
🎧 [Topic] Briefing

[Audio 1 - sent as media attachment]
[Audio 2 - sent as media attachment]
[Audio 3 - sent as media attachment]

📄 Text version: [filename]
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

I analyzed **Clay**
  - *Pipedrive*
  - and [HubSpot](https://hubspot.com).

## Key Findings
- 40% no-show reduction with reminders
- $15-100/user for Pipedrive
- CRM + AI = 🔥
```

**TTS-Optimized Output:**
```
CRM Research. February 13.

I analyzed Clay
  - Pipedrive
  - and HubSpot.

Key Findings.
40 percent no-show reduction with reminders.
15 to 100 dollars per user for Pipedrive.
CRM plus AI equals powerful combination.
```

## Speed Setting

**Default: 1.5x speed**

Why faster?
- Briefings are information-dense
- Users want to consume quickly
- 1.5x is efficient while remaining understandable

**Ameer's Preference:** 1.5x speed (requested Feb 14, 2026)

**Adjust if needed:**
- Normal speed: 1.0x
- Very fast: 1.5x (current setting)

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

**Audio Upload Fails (wrong format):**
- Make sure to use `media` parameter, not `message` with file path
- Retry once
- If still fails, send text only
- Log error

**File Too Large:**
- Split into multiple briefings (each under 4096 chars for TTS)
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
