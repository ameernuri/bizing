---
date: 2026-02-12
tags: skill, briefing, workflow, tts, telegram, 11labs, audio
---

# 📋 Briefing Skill

> *Generate and deliver daily briefings as MP3 audio to Telegram, with TTS-optimized TXT fallback*

## Overview

The briefing skill generates a comprehensive daily summary, converts it to MP3 audio using 11labs TTS, and sends it to the Bizing Telegram group. If audio generation or delivery fails, it automatically falls back to sending a TTS-optimized text file.

## Trigger

User says: **"Send briefing"** or **"Daily briefing"**

## Workflow

### Step 1: Gather Information

Read these files in order:
1. `mind/INDEX.md` — Current focus, goals
2. `mind/symbiosis/standup.md` — Today's tasks, priorities
3. `mind/symbiosis/feedback.md` — Recent learnings, rules
4. `mind/memory/sessions/` — Recent session logs (last 3-5)
5. Git status — Recent commits, branch status
6. `mind/research/backlog.md` — Active research topics

### Step 2: Generate Briefing Content

Create briefing with these sections:

```
BIZING DAILY BRIEFING — [Day, Month Date, Year]

TODAYS FOCUS
[Primary and secondary focus from standup]

RECENT ACTIVITY
[Last 24 hours: commits, PRs, session logs created]

ACTIVE PROJECTS
[Top 3-4 projects with completion percentage]

LEARNINGS TO APPLY
[Key rules and insights from feedback]

BLOCKERS
[Any blockers or NONE]

UPCOMING PRIORITIES
[Next actions to take]

QUICK COMMANDS
[Essential commands for today]

METRICS
[Code quality, test status, mind health]
```

### Step 3: Optimize for TTS

Apply TTS optimization rules (see TTS Optimization section)

### Step 4: Generate Audio via 11labs

1. Call `tts` tool with optimized briefing text
2. Copy generated MP3 from temp to workspace: `briefing-YYYY-MM-DD.mp3`
3. Proceed to Step 5

**Critical:** Must copy file from temp directory before it gets cleaned up

### Step 5: Send MP3 Audio to Telegram (Primary)

1. Send audio file: `message send --target=-4950089674 --media=briefing.mp3`
2. If successful:
   - Delete MP3 from workspace
   - Log: "Audio briefing delivered"
   - DONE
3. If fails: Proceed to Step 6 (Fallback)

### Step 6: Fallback to TXT File

1. Write TTS-optimized text to workspace: `briefing-YYYY-MM-DD.txt`
2. Send text file: `message send --target=-4950089674 --media=briefing.txt`
3. Delete TXT from workspace
4. Log: "Audio failed, text briefing delivered"

## Delivery Priority

1. **Primary:** MP3 audio via Telegram (best experience)
2. **Fallback:** TXT file optimized for TTS (always works)
3. **Never:** Fail completely — always deliver via at least one method

## Implementation Code

### Correct Workflow Implementation

```typescript
async function sendBriefing() {
  const briefingText = generateBriefing();
  const ttsOptimized = optimizeForTTS(briefingText);
  
  // Step 1: Try audio
  try {
    // Generate audio
    const ttsResult = await tts(ttsOptimized);
    // ttsResult returns: MEDIA:/path/to/temp/file.mp3
    
    // CRITICAL: Copy to persistent location before temp cleanup
    const tempPath = ttsResult.replace('MEDIA:', '');
    const persistentPath = `/Users/ameer/.openclaw/workspace/briefing-${Date.now()}.mp3`;
    await copyFile(tempPath, persistentPath);
    
    // Send to Telegram
    await message.send({
      target: '-4950089674',
      media: persistentPath
    });
    
    // Cleanup
    await deleteFile(persistentPath);
    log('Audio briefing delivered');
    return;
    
  } catch (audioError) {
    log('Audio delivery failed:', audioError);
    
    // Step 2: Fallback to text
    const txtPath = `/Users/ameer/.openclaw/workspace/briefing-${Date.now()}.txt`;
    await writeFile(txtPath, ttsOptimized);
    
    await message.send({
      target: '-4950089674',
      media: txtPath
    });
    
    await deleteFile(txtPath);
    log('Text briefing delivered (audio failed)');
  }
}
```

## TTS Optimization Rules

### Symbols to Replace

| Symbol | Replace With |
|--------|--------------|
| % | percent |
| ✅ | completed or done |
| □ | pending or todo |
| → | to or leads to |
| • | dash or bullet |
| # | number or hash |
| & | and |
| / | slash or divided by |
| @ | at |
| $ | dollars |
| : | colon |
| . | dot |
| , | comma |

### Formatting Guidelines

**DO:**
- Use plain text with minimal formatting
- Use words instead of symbols (percent instead of %)
- Write numbers as words for small values (three instead of 3)
- Use clear section headers with colons
- Use bullet points with simple dashes
- Spell out URLs (https colon slash slash)
- Add natural pauses with periods for breathing

**DON'T:**
- Use emojis or special characters
- Use heavy ASCII art or borders
- Use abbreviations without explanation
- Use tables or complex formatting
- Use markdown syntax
- Use long run-on sentences

### Example TTS-Optimized Text

**Instead of:**
```
🎯 FOCUS
• Task 1 ✅ (100%)
• Task 2 □ (50%)
```

**Use:**
```
TODAYS FOCUS
Dash Task 1 completed. 100 percent done.
Dash Task 2 pending. 50 percent complete.
```

## 11labs Configuration

### Voice Settings
- **Voice:** Nova (warm, conversational)
- **Model:** eleven turbo v2.5 (fast, natural)
- **Speed:** 1.0 (normal pace)
- **Format:** MP3

### API Key
Configure in OpenClaw:
```bash
openclaw configure --section tts
# Enter 11labs API key
```

### Fallback Triggers
Try TXT fallback if:
- 11labs API returns error
- Audio generation times out (>30 seconds)
- MP3 file is empty or corrupt
- Telegram rejects audio file
- Network error during upload

## Complete Example Briefing

```
BIZING DAILY BRIEFING — Thursday, February 12, 2026

TODAYS FOCUS
Primary: Mind framework enforcement. Every interaction reads and updates mind.
Secondary: Keep mind synchronized with code reality.

RECENT ACTIVITY
In the last 24 hours:
Dash Three commits pushed. Admin dashboard docs and tests. React keys fixed. Testing infrastructure installed.
Dash Pull request 14 is open. Title: feat never skip tests plus admin dashboard fixes.
Dash Five session logs created. Research backlog. Admin docs. Testing setup. Codesync workflow. Git rules.

ACTIVE PROJECTS
One: Mind Awareness System. 90 percent complete. Bizing can query its own mind via API.
Two: Testing Infrastructure. 95 percent complete. All tests passing.
Three: Admin Dashboard. 85 percent complete. Chat interface with markdown.

LEARNINGS TO APPLY
Critical rule one: Do not commit without verification. Test first, then commit.
Critical rule two: Mind framework is mandatory. Every interaction must update mind.
Critical rule three: Never commit to main branch. Always use feature branches.
Critical rule four: Never skip tests. Type check, unit tests, end to end tests.

BLOCKERS
None. OpenAI integration is working. Development is unblocked.

UPCOMING PRIORITIES
High priority: Continue velocity first development. Merge pull request 14.
Medium priority: Set up CI slash CD pipeline. Add integration tests.

QUICK COMMANDS
For testing: cd apps slash api and pnpm typecheck. pnpm test run.
For mind: cat mind slash INDEX dot md for entry point.
For git: git branch to check branch.

METRICS
Code quality: TypeScript errors at zero. All tests passing.
Mind health: 77 total files. Zero orphaned files. 10 recent sessions.

END OF BRIEFING
Next steps: Review focus items. Check standup for tasks.
```

## Error Handling

### Audio Failure Scenarios

**TTS Generation Fails:**
- Log error (11labs API issue)
- Immediately proceed to TXT fallback
- Do not retry (wastes time)

**File Copy Fails:**
- Log error (disk space, permissions)
- Try TXT fallback
- Notify user of issue

**Telegram Audio Upload Fails:**
- Log error (file too large, network)
- Try TXT fallback
- Telegram TXT has higher size limits

**Timeout:**
- If audio generation >30s, cancel
- Fallback to TXT
- Log timeout for investigation

### Success Confirmation

After successful delivery:
- Log delivery method: "MP3 audio delivered" or "TXT fallback delivered"
- Update standup with briefing timestamp
- Delete workspace file
- No further action needed

## Testing the Workflow

### Test Audio Delivery
```bash
# Trigger briefing
"Send briefing"

# Expected:
# 1. TTS generates MP3
# 2. File copied to workspace
# 3. MP3 sent to Telegram
# 4. File cleaned up
# 5. Log: "Audio briefing delivered"
```

### Test Fallback
```bash
# Temporarily break 11labs (wrong API key)
# Trigger briefing

# Expected:
# 1. TTS fails
# 2. TXT file created
# 3. TXT sent to Telegram
# 4. File cleaned up
# 5. Log: "Text briefing delivered (audio failed)"
```

## Integration

### Location
- **Skill:** `mind/skills/briefing/SKILL.md`
- **Template:** `mind/skills/briefing/template.txt`
- **Tools:** 11labs TTS, Telegram messaging

### Related Files
- `mind/skills/workflow/session-logging` — Session structure
- `mind/symbiosis/standup` — Daily priorities
- `mind/symbiosis/feedback` — Learnings and rules
- `TOOLS.md` — 11labs API key

### Delivery Targets
- **Primary:** Bizing Telegram group (`-4950089674`)
- **Format:** MP3 audio file
- **Fallback:** TXT file (TTS-optimized)

---

*Briefing skill: MP3 audio to Telegram primary, TXT fallback. Always delivers.*
