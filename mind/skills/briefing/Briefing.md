---
date: 2026-02-13
tags: 
  - skill
  - briefing
  - hub
  - overview
---

# 📋 Briefing Skills Hub

> *Overview of all briefing capabilities*

## Overview

Briefings are summaries delivered to help you stay informed. We have **two specialized briefing skills**:

## Available Skills

### 1. [[mind/skills/briefing/text-briefing|📝 Text Briefing]]

**Purpose:** Create written summaries of research
  - status
  - or findings.

**When to use:**
- "Create text briefing on CRM research"
- "Write summary of today's work"
- "Summarize the findings"

**Output:** Natural text saved as `.txt` file

---

### 2. [[mind/skills/briefing/audio-briefing|🔊 Audio Briefing]]

**Purpose:** Convert text to audio and deliver both files.

**When to use:**
- "Send audio briefing"
- "Convert this to audio"
- "Brief me on [topic]" (implies audio)

**Output:** 
- MP3 audio (1.15x speed for efficiency)
- Text file (for reference)

**Both files sent together** — listen to audio
  - reference text later.

---

## Quick Reference

| Want | Use | Get |
|------|-----|-----|
| Written summary | Text Briefing | `.txt` file |
| Audio summary | Audio Briefing | `.mp3` + `.txt` files |
| Both | Audio Briefing | Both files automatically |

## Common Workflows

### Workflow 1: Daily Status Audio Briefing
```
User: "Send daily briefing"
→ Text Briefing: Gather standup
  - feedback
  - sessions
→ Audio Briefing: Convert to audio
→ Send: MP3 + TXT to group
```

### Workflow 2: Research Summary
```
User: "Brief me on CRM research"
→ Text Briefing: Read research/findings/crm-comparison.md
→ Audio Briefing: Convert to audio (1.15x speed)
→ Send: MP3 + TXT to group
```

### Workflow 3: Text Only
```
User: "Create text summary of standup"
→ Text Briefing: Generate text
→ Send: TXT file only
```

## Delivery Targets

- **Daily briefings:** Always to Bizing group
- **Specialized briefings:** To source of request (group or DM)
- **Both files:** Always send MP3 + TXT together

## TTS Optimization

The Audio Briefing skill automatically:
- Removes markdown (`#`
  - `##`
  - `-`
  - `*`)
- Converts URLs to spoken form ("example dot com")
- Handles symbols (`%` → "percent"
  - `$` → "dollars")
- Removes emojis
- Sets speed to 1.15x for efficiency

**You write naturally** — the skill handles conversion.

## File Naming

- Text: `briefing-[topic]-YYYY-MM-DD.txt`
- Audio: `briefing-[topic]-YYYY-MM-DD.mp3`

## Integration

**Skills:**
- [[mind/skills/briefing/text-briefing|Text Briefing]] — Create written summaries
- [[mind/skills/briefing/audio-briefing|Audio Briefing]] — Convert to audio
  - send both

**Related:**
- `mind/symbiosis/standup.md` — Daily priorities
- `mind/symbiosis/feedback.md` — Learnings
- `mind/research/findings/` — Research topics
- `mind/memory/sessions/` — Work logs

---

*Briefing Hub: Text for writing
  - Audio for listening + reference. Both skills work together.*
