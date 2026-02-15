---
date: 2026-02-13
tags: 
  - skill
  - briefing
  - text
  - summary
---

# 📝 Text Briefing Skill

> *Generate a written summary of research
  - status
  - or findings*

## Purpose

Create a clear
  - readable text summary that can be:
- Read directly by the user
- Converted to audio via the Audio Briefing skill
- Sent as a follow-up to audio briefings

## Trigger

User says: **"Create text briefing"** or **"Write summary of [topic]"**

## Workflow

### Step 1: Gather Information

Read relevant files based on briefing type:

**For Daily Status:**
1. `mind/symbiosis/standup.md` — Today's priorities
2. `mind/symbiosis/feedback.md` — Recent learnings
3. `mind/memory/sessions/` — Recent sessions (last 3-5)
4. Git status — Recent commits

**For Research Summary:**
1. `mind/research/findings/[topic].md` — Research findings
2. Related research files
3. Session logs about this topic

**For Project Update:**
1. Project files in `mind/knowledge/projects/`
2. Related session logs
3. Standup and feedback

### Step 2: Write Natural Text

Create text in **natural reading format** — NOT TTS-optimized yet.

**Structure:**
```
# [Topic] Briefing — [Date]

## Summary
[2-3 sentence overview]

## Key Points
- [Point 1]
- [Point 2]
- [Point 3]

## Details
[Natural paragraphs with full sentences]

## Next Steps
- [Action 1]
- [Action 2]
```

**Writing Guidelines:**
- Use natural language (contractions OK: "don't"
  - "it's")
- Use bullet points with dashes
- Use numbers normally ("40%" not "40 percent")
- Use emojis sparingly
- Write like you're explaining to a person

### Step 3: Save to Workspace

Save as: `briefing-[topic]-YYYY-MM-DD.txt`

Example: `briefing-crm-research-2026-02-13.txt`

### Step 4: Handoff to Audio Briefing (Optional)

If user wants audio:
- Pass the text file to Audio Briefing skill
- Audio Briefing will optimize for TTS and convert

## Example Output

```
# CRM Research Briefing — February 13
  - 2026

## Summary
I analyzed three leading CRM platforms — Clay
  - Pipedrive
  - and HubSpot — to identify features worth integrating into Bizing. The key finding: most CRMs focus on pre-booking lead generation or are generic. Bizing's opportunity is a post-booking CRM built specifically for booking businesses.

## Key Points
- Clay.com: Data enrichment + AI
  - credit-based pricing
  - $0-$720/mo
- Pipedrive: Visual sales pipeline
  - $15-$100/user/mo
- HubSpot: All-in-one platform
  - free tier but expensive at scale
- Top 5 features Bizing needs: automated reminders
  - subscriptions
  - payments
  - CRM with loyalty
  - analytics

## Details

Clay combines 75+ data sources into one enrichment layer. They use AI to research leads and draft personalized messages. What they do right: credit-based pricing means you pay for what you use. What they do wrong: no booking features
  - overkill for simple needs.

Pipedrive offers a visual sales pipeline with Kanban-style deal tracking. They focus on activity-based selling. Strong mobile apps and 500+ integrations.

HubSpot offers a free tier with unlimited contacts. They combine marketing
  - sales
  - and service. Expensive at scale ($800+/mo for full features).

## Next Steps
- Design booking-native CRM features for Bizing
- Integrate top 5 complementary features into booking platform
- Continue monitoring competitor developments
```

## Integration

**Related Skills:**
- [[mind/skills/briefing/audio-briefing|Audio Briefing]] — Convert text to audio
- [[mind/skills/briefing|Briefing Hub]] — Overview of all briefing skills

**Output Location:**
- Saved to workspace as `.txt` file
- Can be sent via Telegram as text file
- Can be converted to audio

---

*Text Briefing: Write natural summaries
  - then optionally convert to audio.*
