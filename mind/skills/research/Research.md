---
date: 2026-02-15
tags:
  - skill
  - research
  - topics
  - perplexity
  - automation
---

# 🔬 Research Skill

> Automated research topic generation and execution via the Daydreamer daemon.

---

## Overview

The **Research Skill** enables Bizing to autonomously identify and execute research tasks through two Daydreamer tasks:

1. **Topic Generator** (8% of runs) - Uses Kimi to find research topics from existing research
2. **Research Executor** (2% of runs) - Uses Perplexity to conduct deep research

---

## How It Works

### 1. Topic Generation (8% weight)

The Daydreamer analyzes files in `mind/research/` and generates quality research topics.

**Process:**
1. Scans research folder for existing content
2. Uses Kimi to identify gaps and opportunities
3. Creates dated topic files in `mind/research/topics/`

**Output Format:**
```markdown
# Topic Title

**Status:** Proposed  
**Created:** 2026-02-15  
**Priority:** Medium

## Description

What this research would explore...

## Why This Matters

Why understanding this is important...

## Source Files

- [[research/source-file.md]]
- [[research/another-source.md]]

## Research Questions

- [ ] What is the current state of knowledge?
- [ ] What are key insights or findings?
- [ ] How does this relate to Bizing's domain?

## Notes

*Research findings added here*

## Tags

#research #topic #proposed
```

### 2. Research Execution (2% weight)

The Daydreamer selects pending topics and conducts research via Perplexity.

**Process:**
1. Finds topics with "Status: Proposed"
2. Uses Perplexity for deep research
3. Updates topic file with findings
4. Marks as "Status: Complete"

---

## Directory Structure

```
mind/research/
├── topics/                    # Generated research topics
│   ├── 2026-02-15-ai-agent-commission-models.md
│   └── 2026-02-15-booking-platform-gdpr-compliance.md
├── findings/                  # Research findings and reports
├── competitors/               # Competitor analysis
└── technology/                # Technology research
```

---

## Quality Standards

### Good Research Topics

✅ **Specific and actionable:**
- "AI agent commission models in service marketplaces"
- "GDPR compliance strategies for booking platforms"

✅ **Connected to existing research:**
- References source files
- Builds on known knowledge

✅ **Valuable to Bizing:**
- Relevant to booking/services domain
- Could influence product decisions

### Bad Research Topics

❌ Too vague:
- "AI" (too broad)
- "Technology" (not specific)

❌ Not actionable:
- "History of booking" (academic, not practical)

❌ Duplicates existing knowledge:
- Topics already well-covered

---

## Integration with Daydreamer

### Topic Generator Task

```javascript
// Runs 8% of the time
// Uses Kimi (kimi-coding/k2p5)
// Analyzes 5 research files
// Generates 1-2 quality topics
```

### Research Executor Task

```javascript
// Runs 2% of the time
// Uses Perplexity API
// Researches one pending topic
// Updates file with findings
```

---

## Manual Research

### Creating Topics Manually

```bash
cd mind/research/topics
cat > 2026-02-15-your-topic.md << 'EOF'
# Your Research Topic

**Status:** Proposed  
**Created:** 2026-02-15  
**Priority:** High

## Description

What you want to research...

## Why This Matters

Why it's important...

## Source Files

- [[research/source.md]]

## Research Questions

- [ ] Question 1?
- [ ] Question 2?

## Notes

EOF
```

### Conducting Research Manually

Use the Perplexity skill:
```
Research: [your topic]
```

Or use the web search tool:
```
Search for information about [topic]
```

---

## Research Workflow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Existing       │────▶│  Topic Generator │────▶│  Research       │
│  Research       │     │  (Daydreamer 8%) │     │  Topics         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Knowledge      │◀────│  Research        │◀────│  Research       │
│  Base           │     │  Executor        │     │  Execution      │
│  (Updated)      │     │  (Daydreamer 2%) │     │  (Perplexity)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Related Skills

- [[mind/skills/dreaming|Dreaming]] — Daydreamer daemon that runs research tasks
- [[mind/skills/curiosity|Curiosity]] — Questions that may become research topics
- [[mind/skills/briefing|Briefing]] — Summarizing research findings
- [[mind/skills/analysis|Analysis]] — Analyzing research data

---

*Research: The foundation of informed decisions.*
