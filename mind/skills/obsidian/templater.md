---
date: 2026-02-16
tags:
  - skill
  - obsidian
  - templater
  - templates
  - automation
---

# 📝 Templater Skill

> Dynamic templates for Obsidian with JavaScript support

---

## What is Templater?

**Templater** is an Obsidian plugin that enables dynamic, programmable templates. Unlike Obsidian's built-in templates, Templater supports JavaScript execution, date manipulation, and dynamic content generation.

**Use cases:**
- Daily notes with automatic date headers
- Meeting notes with participant lists
- Project templates with calculated dates
- Automated content generation
- Dynamic file naming

---

## Installation

1. Open Obsidian Settings → Community Plugins
2. Browse → Search "Templater"
3. Install → Enable
4. Configure template folder location

**Settings:**
- **Template folder location:** `mind/templates/` (or your preferred folder)
- **Trigger Templater on new file creation:** Enable for automatic templating

---

## Syntax Basics

### Static Text
```markdown
This text appears exactly as written.
```

### Dynamic Commands
```markdown
Today's date: <% tp.date.now() %>
Current file: <% tp.file.title %>
Yesterday: <% tp.date.yesterday() %>
Tomorrow: <% tp.date.tomorrow() %>
```

### JavaScript Execution
```markdown
<%* 
// JavaScript code block
const date = new Date();
const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
%>
Today is <%= dayOfWeek %>.
```

---

## Core Commands

### Date Commands

```markdown
<!-- Current date -->
<% tp.date.now() %>
<% tp.date.now("YYYY-MM-DD") %>
<% tp.date.now("dddd, MMMM Do YYYY") %>

<!-- Yesterday/Tomorrow -->
<% tp.date.yesterday() %>
<% tp.date.tomorrow() %>

<!-- Add/subtract time -->
<% tp.date.now("YYYY-MM-DD", 7) %>  <!-- +7 days -->
<% tp.date.now("YYYY-MM-DD", -7) %> <!-- -7 days -->

<!-- Day of week -->
<% tp.date.now("dddd") %>

<!-- Week number -->
<% tp.date.now("WW") %>
```

### File Commands

```markdown
<!-- Current file info -->
<% tp.file.title %>
<% tp.file.folder() %>
<% tp.file.path() %>
<% tp.file.creation_date() %>
<% tp.file.last_modified_date() %>

<!-- File operations -->
<% tp.file.rename("new-name.md") %>
<% tp.file.move("folder/new-name.md") %>
<% tp.file.create_new("content", "filename.md") %>

<!-- Include other files -->
<% tp.file.include("[[template-parts/header]]") %>
```

### System Commands

```markdown
<!-- Clipboard -->
<% tp.system.clipboard() %>

<!-- Prompt user -->
<% tp.system.prompt("Enter your name:") %>

<!-- Suggest -->
<% tp.system.suggester(["Option 1", "Option 2", "Option 3"], ["val1", "val2", "val3"]) %>

<!-- Open file -->
<% tp.system.open_url("https://example.com") %>
```

### Frontmatter Commands

```markdown
<!-- Get frontmatter -->
<% tp.frontmatter.key %>

<!-- Example: if frontmatter has 'tags' -->
<% tp.frontmatter.tags %>
```

---

## Execution Modes

### Output Mode (`<% %>`)
Outputs the result directly into the note.
```markdown
Date: <% tp.date.now() %>
<!-- Result: Date: 2026-02-16 -->
```

### Silent Mode (`<%* %>`)
Executes JavaScript without outputting to the note.
```markdown
<%* 
// This runs but produces no visible output
const myVar = "hello";
%>
```

### Dynamic Mode (`<%+ %>`)
Keeps the command dynamic - re-evaluated on every view.
```markdown
Last opened: <%+ tp.file.last_modified_date() %>
```

### Async Mode (`<%~ %>`)
For async operations.
```markdown
<%~ tp.file.create_new("content", "file.md") %>
```

---

## JavaScript Integration

### Variables
```markdown
<%* 
let name = "Bizing";
let version = "2.0";
%>
Name: <%= name %>
Version: <%= version %>
```

### Conditionals
```markdown
<%* 
const hour = new Date().getHours();
let greeting;
if (hour < 12) {
    greeting = "Good morning";
} else if (hour < 18) {
    greeting = "Good afternoon";
} else {
    greeting = "Good evening";
}
%>
<%= greeting %>!
```

### Loops
```markdown
<%* 
const tasks = ["Review PRs", "Update docs", "Test API"];
let output = "";
for (let task of tasks) {
    output += `- [ ] ${task}\n`;
}
%>
<%= output %>
```

### Functions
```markdown
<%* 
function formatDate(date, format) {
    return moment(date).format(format);
}
%>
Formatted: <%= formatDate(new Date(), "MMMM Do, YYYY") %>
```

---

## Common Templates

### Daily Note
```markdown
---
date: <% tp.date.now("YYYY-MM-DD") %>
tags:
  - daily
---

# <% tp.date.now("dddd, MMMM Do YYYY") %>

## Morning

### Priorities
- [ ] Priority 1
- [ ] Priority 2
- [ ] Priority 3

## Notes


## Evening

### Completed
- 

### Tomorrow
- 
```

### Meeting Note
```markdown
---
date: <% tp.date.now("YYYY-MM-DD") %>
time: <% tp.date.now("HH:mm") %>
type: meeting
---

# Meeting: <% tp.system.prompt("Meeting title:") %>

**Date:** <% tp.date.now("YYYY-MM-DD") %>  
**Time:** <% tp.date.now("HH:mm") %>  
**Attendees:** 

## Agenda

1. 
2. 
3. 

## Notes


## Action Items

- [ ] 
```

### Project Task
```markdown
---
created: <% tp.date.now("YYYY-MM-DD") %>
status: proposed
tags:
  - task
  - project/<% tp.system.suggester(["API", "Web", "Mobile"], ["api", "web", "mobile"]) %>
---

# <% tp.file.title %>

## Description


## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Related

- 
```

### New Skill
```markdown
---
date: <% tp.date.now("YYYY-MM-DD") %>
tags:
  - skill
---

# 🎯 <% tp.file.title.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) %>

> Brief description of what this skill does

---

## What is <% tp.file.title %>?

Explain the concept/tool/process.

---

## When to Use

Describe situations where this skill applies.

---

## How to Use

### Step-by-step process

1. First step
2. Second step
3. Third step

---

## Examples

### Example 1: Basic usage

```
Show example here
```

### Example 2: Advanced usage

```
Show advanced example
```

---

## Related

- [[link-to-related-skill]] — Description
- [[another-related-file]] — Description

---

*Skill documentation*
```

---

## User Scripts

Templater supports custom user scripts for complex operations.

**Location:** `.obsidian/templater-scripts/`

### Example: Create Weekly Note
```javascript
// weekly-note.js
async function createWeeklyNote() {
    const startOfWeek = tp.date.now("YYYY-MM-DD", -tp.date.now("E"));
    const endOfWeek = tp.date.now("YYYY-MM-DD", 6 - tp.date.now("E"));
    
    const content = `---
start: ${startOfWeek}
end: ${endOfWeek}
tags:
  - weekly
---

# Week of ${startOfWeek}

## Goals

- 

## Review

`;
    
    await tp.file.create_new(content, `weekly/${startOfWeek}.md`);
}

module.exports = createWeeklyNote;
```

**Usage in template:**
```markdown
<%* await tp.user.weeklyNote() %>
```

---

## Tips & Best Practices

### 1. Test Templates
Create a `test` folder for testing templates before using them.

### 2. Use Moment.js
Templater includes Moment.js for advanced date formatting:
```markdown
<% moment().add(7, 'days').format("YYYY-MM-DD") %>
```

### 3. Handle Errors
Wrap risky operations:
```markdown
<%* try { %>
<%= tp.file.include("[[missing-file]]") %>
<%* } catch (e) { %>
File not found
<%* } %>
```

### 4. Organize Templates
```
mind/templates/
├── daily/
├── meeting/
├── project/
├── research/
└── skills/
```

### 5. Use Frontmatter
Always include frontmatter for machine-readable metadata:
```markdown
---
date: <% tp.date.now("YYYY-MM-DD") %>
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
tags:
  - template
---
```

---

## Troubleshooting

### Template not triggering
- Check Templater is enabled
- Verify template folder path in settings
- Ensure "Trigger on new file creation" is enabled

### JavaScript errors
- Check console (Ctrl+Shift+I / Cmd+Option+I)
- Validate syntax in template
- Test in isolation

### Date formatting issues
- Use Moment.js format tokens: https://momentjs.com/docs/#/displaying/format/
- Verify locale settings

---

## Resources

- **Plugin:** Community Plugins → Templater
- **Documentation:** https://silentvoid13.github.io/Templater/
- **GitHub:** https://github.com/SilentVoid13/Templater
- **Examples:** https://github.com/SilentVoid13/Templater/discussions

---

## Related

- [[mind/skills/obsidian/Obsidian]] — Obsidian usage
- [[mind/skills/creating-files|Creating Files Skill]] — File creation patterns
- [[mind/skills/obsidian/dataview|Dataview Skill]] — Querying notes

---

*Templater: Dynamic templates for powerful note-taking*
