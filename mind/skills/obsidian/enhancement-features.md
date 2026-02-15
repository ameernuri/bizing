---
date: 2026-02-13
tags: 
  - skill
  - obsidian
  - features
  - enhancement
---

# 🔮 Obsidian Enhancement Features

> Advanced Obsidian features to enrich and evolve the Bizing mind

---

## Core Obsidian Features (Built-in)

### 1. **Graph View** — Visual Connection Explorer

**What it does:** Shows all notes as nodes
  - links as edges

**Use for Bizing:**
- See orphaned files (disconnected nodes)
- Identify knowledge clusters
- Find connection gaps
- Visualize mind structure

**How to use:**
```
Cmd+G (or Ctrl+G) → Open Graph View
Filter: path:mind/skills  # Show only skills
Filter: tag:#session      # Show only sessions
```

**Pro tip:** Color nodes by folder:
- `mind/skills` = Blue
- `mind/memory` = Green
- `mind/research` = Purple

---

### 2. **Canvas** — Infinite Visual Whiteboard

**What it does:** Place notes
  - images
  - cards on a freeform canvas

**Use for Bizing:**
- [[mind/canvas/architecture-overview|Architecture diagrams]]
- [[mind/canvas/consciousness-map|Mind maps]]
- Feature relationship charts
- Decision flowcharts

**How to use:**
```
Cmd+Scroll → Zoom in/out
Drag → Move canvas
Double-click → Add card
[[note]] → Embed existing note
```

**Existing canvases:**
- [[../canvas/architecture-overview|Architecture Overview]]
- [[../canvas/booking-domain-architecture|Booking Domain]]
- [[../canvas/event-driven-architecture|Event-Driven]]
- [[../canvas/api-first-design|API-First Design]]

---

### 3. **Daily Notes** — Temporal Journaling

**What it does:** Auto-create dated notes for daily thoughts

**Use for Bizing:**
- Daily standup replacement
- Quick captures
- End-of-day summaries
- Linking to sessions

**Template:**
```markdown
---
date: <% tp.date.now("YYYY-MM-DD") %>
tags: 
  - daily
---

# <% tp.date.now("YYYY-MM-DD dddd") %>

## 🎯 Focus

## ✅ Done

## 💡 Learned

## 🔗 Links to Sessions
- [[../memory/sessions/]]
```

---

### 4. **Backlinks** — "What Links Here?"

**What it does:** Shows all notes that link to current note

**Use for Bizing:**
- See impact of a decision
- Find related work
- Discover dependencies
- Check if file is orphaned

**View:** Right sidebar → Backlinks

**Example:**
Reading [[mind/skills/codesync]] → See all sessions that mention CodeSync

---

### 5. **Outline** — Document Structure

**What it does:** Shows all headers in current note

**Use for Bizing:**
- Navigate long files quickly
- See session structure
- Jump to specific sections

**View:** Right sidebar → Outline

---

### 6. **Tags Pane** — Filter by Tag

**What it does:** Shows all #tags and click to filter

**Use for Bizing:**
- Find all #urgent items
- See all #session logs
- Filter by #kanban boards

**Click any tag** in a note to see all files with that tag

---

### 7. **Search** — Full-Text Find

**What it does:** Search across all file content

**Search operators:**
```
"exact phrase"       # Exact match
path:mind/skills     # Folder search
tag:#urgent          # Tag search
file:session         # Filename search
content:"decision"   # Content only
```

---

### 8. **Command Palette** — Quick Actions

**What it does:** Access all commands via keyboard

**Shortcuts:**
```
Cmd+P → Command palette
Cmd+O → Quick open file
Cmd+Shift+F → Search
Cmd+G → Graph view
Cmd+Click → Follow link
```

---

### 9. **Workspaces** — Saved Layouts

**What it does:** Save window arrangements

**Use for Bizing:**
- "Development" layout: Code on left
  - mind on right
- "Planning" layout: Kanban + Graph view
- "Writing" layout: Editor only
  - focus mode

**Save:** Cmd+P → "Workspaces: Save layout"

---

### 10. **Bookmarks** — Quick Access

**What it does:** Pin important files for instant access

**Bookmarks for Bizing:**
- [[mind/INDEX]]
- [[mind/memory/RAM]]
- [[mind/MAP]]
- [[mind/workspace/feature-space]]

**Add:** Cmd+P → "Bookmarks: Bookmark current file"

---

## Recommended Community Plugins

### **Breadcrumbs** — Hierarchical Navigation

**What it does:** Show parent/child/sibling relationships

**Use for Bizing:**
- Skill hierarchy: CodeSync → Git → Commits
- Feature hierarchy: Booking → Calendar → Views
- Navigate up/down the tree

**Install:** Settings → Community plugins → Breadcrumbs

---

### **Journey** — Find Paths Between Notes

**What it does:** Discover how two notes are connected

**Use for Bizing:**
- How does [[mind/skills/codesync]] relate to [[mind/workspace/feature-space]]?
- Find indirect connections
- Discover unexpected relationships

---

### **Supercharged Links** — Styled Links

**What it does:** Style links based on metadata

**Use for Bizing:**
- Color-code by file type
- Icons for sessions vs skills vs research
- Visual scanning aid

**Config:**
```yaml
# Link to skill file → Blue
path: mind/skills → color: #3498db

# Link to session → Green  
date: present → color: #2ecc71

# Link to urgent → Red
tag: #urgent → color: #e74c3c
```

---

### **Metadata Menu** — Forms for Frontmatter

**What it does:** Edit YAML frontmatter with forms

**Use for Bizing:**
- Dropdown for session types
- Date picker for dates
- Checkbox for status
- No more YAML syntax errors

---

### **QuickAdd** — Rapid Capture

**What it does:** Quick capture ideas without breaking flow

**Use for Bizing:**
- Capture to RAM instantly
- Add to feature space
- Create session stub
- Log quick learning

**Setup:**
```
Macro: "Quick Session"
- Create file: mind/memory/sessions/{date}-quick.md
- Template: session template
- Open: true
```

---

### **Note Refactor** — Split/Combine Notes

**What it does:** Break long notes into pieces or combine short ones

**Use for Bizing:**
- Split large research findings
- Combine related daily notes
- Extract decisions into separate files
- Refactor old sessions

---

### **Mind Map** — Outline to Visual Map

**What it does:** Convert markdown outline to mind map

**Use for Bizing:**
- Visualize feature hierarchies
- Map decision trees
- Brainstorm architecture
- Present to stakeholders

---

### **Excalidraw** — Hand-Drawn Diagrams

**What it does:** Sketch diagrams that look hand-drawn

**Use for Bizing:**
- System architecture sketches
- User flow diagrams
- Wireframes
- Quick whiteboard sessions

---

### **Admonitions** — Callout Boxes

**What it does:** Styled boxes for important info

**Syntax:**
```markdown
> [!info]> This is an info callout

> [!warning]> This is a warning

> [!tip]> Pro tip here
```

**Use for Bizing:**
- Highlight key decisions
- Mark experimental features
- Call out deprecated content
- Tips in skills

---

## Mind Enhancement Patterns

### Pattern 1: Weekly Review Canvas

Create a canvas each week:
- Place completed sessions
- Highlight key learnings
- Link to next week's priorities
- Visual progress tracker

### Pattern 2: Decision Trees

Use Canvas for decisions:
- Start with question
- Branch to options
- Link to research
- Mark chosen path

### Pattern 3: Tag-Based Dashboard

Use Dataview for dashboard:
```dataview
TABLE date
  - type
  - status
FROM "mind/memory/sessions"
WHERE date > date(today) - dur(7 days)
SORT date DESC
```

### Pattern 4: Graph-Based Cleanup

Monthly graph review:
1. Open Graph View
2. Find isolated nodes (orphaned files)
3. Either link them or delete
4. Check for broken connections

---

## Implementation Priority

### Immediate (Add Now)
1. **Graph View** — Use daily to find orphans
2. **Bookmarks** — Pin INDEX
  - RAM
  - MAP
3. **Tags** — Add to all existing files
4. **Admonitions** — Highlight key sections

### Short-term (This Week)
5. **Breadcrumbs** — Add hierarchy navigation
6. **Metadata Menu** — Easier frontmatter editing
7. **Canvas** — Create more architecture diagrams
8. **QuickAdd** — Rapid session creation

### Long-term (This Month)
9. **Journey** — Find hidden connections
10. **Supercharged Links** — Visual link styling
11. **Mind Map** — Present to team
12. **Excalidraw** — Detailed architecture docs

---

## Quick Wins

### Enable These Now:

1. **Pin INDEX to sidebar**
   - Open INDEX → Right-click → "Pin"

2. **Show backlinks in sidebar**
   - Settings → Backlinks → Show in right sidebar

3. **Enable daily notes**
   - Settings → Daily notes → Turn on
   - Template: `mind/.templates/daily.md`

4. **Tag all recent files**
   - Add `#session` to sessions
   - Add `#skill` to skills
   - Add `#research` to findings

---

## Related

- [[mind/skills/obsidian/kanban]] — Visual task boards
- [[mind/skills/obsidian/dataview]] — Query your mind
- [[mind/skills/obsidian/templater]] — Auto-generate files
- [[mind/skills/obsidian/editing-files]] — File editing
- [[mind/skills/obsidian/index]] — Obsidian skills hub

---

*Obsidian is more than a note-taker—it's a thinking environment.*
