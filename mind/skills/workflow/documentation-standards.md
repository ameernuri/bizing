# 📚 Code Documentation Standards

*Every file must tell its story. Every function must explain its purpose.*

---

## 🎯 Philosophy

**Self-Documenting Codebase**: The code should explain itself to:
- New developers joining the project
- AI assistants (like me) understanding context
- Future maintainers (including your future self)
- The Bizing AI mind (embeddings include these docs)

---

## 📋 File-Level Documentation

Every file MUST have this header:

```typescript
/**
 * @fileoverview [One-sentence description of what this file does]
 *
 * @description
 * [2-3 sentences explaining the purpose, why it exists, and how it fits
 * into the larger architecture. What problem does it solve?]
 *
 * @architecture
 * Related code files (use relative paths):
 * - {@link ./related-service.ts} - What this file does
 * - {@link ../other-module.ts} - How it's related
 * 
 * Related mind files (use full path from mind/):
 * - mind/knowledge/domain/topic.md - Domain knowledge
 * - mind/skills/workflow/pattern.md - Pattern documentation
 * 
 * Used by:
 * - {@link ../server.ts} - API endpoints
 * - {@link ./consumer.ts} - Service consumers
 *
 * Depends on:
 * - External libraries
 * - {@link ./dependency.ts} - Internal dependencies
 *
 * @design-decisions
 * - Why this approach? [Explain key architectural decisions]
 * - Alternatives considered: [What was rejected and why]
 *
 * @todo
 * - [ ] TODO: [Specific, actionable item with context]
 * - [ ] FIXME: [Known issue that needs fixing]
 * - [ ] HACK: [Temporary workaround, explain why]
 *
 * @created 2026-02-11
 * @author [Who created it - for human files]
 * @last-modified 2026-02-11
 * @version 1.0.0
 */
```

### Example: mind-api.ts

```typescript
/**
 * @fileoverview Core API for Bizing AI to query its own mind state
 *
 * @description
 * This module provides the foundational interface between Bizing AI and its
 * knowledge base (the /mind directory). It enables function calling so the
 * LLM can dynamically retrieve current focus, tasks, blockers, and file
 * contents during conversations.
 *
 * The mind is treated as a living knowledge graph that evolves with the
 * project. This API abstracts file system operations into semantic queries
 * the AI can understand and use.
 *
 * @architecture
 * Related code files:
 * - {@link ./mind-map.ts} - File discovery and relationship mapping
 * - {@link ./mind-embeddings.ts} - Semantic search with OpenAI embeddings
 * - {@link ./llm.ts} - LLM integration and function calling
 * 
 * Related mind files:
 * - mind/MIND-FRAMEWORK.md - Mandatory workflow rules
 * - mind/MAP.md - Complete file index
 * - mind/skills/workflow/documentation-standards.md - This documentation guide
 * 
 * Used by:
 * - {@link ../server.ts} - API endpoints
 * - {@link ./llm.ts} - Function calling integration
 *
 * Depends on:
 * - Node.js fs module
 * - Obsidian-style markdown parsing
 *
 * @design-decisions
 * - File-based storage: Chose markdown files over database for:
 *   - Human readability in Obsidian
 *   - Git version control
 *   - AI-friendly structure with wiki links
 * - Synchronous reads for simplicity (can optimize to async if needed)
 * - Caching at mind-map layer, not here (single source of truth)
 *
 * @todo
 * - [ ] TODO: Add async versions of all functions for better performance
 * - [ ] TODO: Implement error retry logic for file reads
 * - [ ] FIXME: getMindFile doesn't handle nested paths correctly
 * - [ ] IDEA: Add validation for mind file structure
 *
 * @created 2026-02-11
 * @version 1.0.0
 */
```

---

## 🔗 Linking Conventions

### In TypeScript/JavaScript Files

**For code symbols (functions, classes, interfaces):**
```typescript
/**
 * @see {@link functionName} For related functionality
 * @see {@link ClassName.method} For specific method
 * @see {@link ./file.ts} For related file
 */
```

**For mind files (markdown in /mind directory):**
```typescript
/**
 * Related knowledge:
 * - mind/knowledge/domain/topic.md - Domain documentation
 * - mind/skills/workflow/pattern.md - Implementation pattern
 * - mind/symbiosis/feedback.md - Learnings and rules
 * 
 * @see mind/MIND-FRAMEWORK.md - Mandatory workflow
 */
```

**VS Code understands `{@link}` and shows clickable links!**

### In Markdown Files

**Use wiki links for Obsidian compatibility:**
```markdown
See [[symbiosis/feedback]] for learnings.
Read [[skills/workflow/documentation-standards]] for details.
Check [[knowledge/domain/topic|Domain Topic]] for context.
```

---

## 🔧 Function-Level Documentation

Every exported function MUST have:

```typescript
/**
 * [One-line description of what the function does]
 *
 * @description
 * [Detailed explanation if needed. When would you use this?
 * What are the edge cases?]
 *
 * @param paramName - [Description, type, constraints, defaults]
 * @param options - [For object params, document key fields]
 * @returns [What it returns, shape of data, possible values]
 * @throws [What errors can be thrown and when]
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = myFunction('input');
 *
 * // With all options
 * const result = myFunction('input', {
 *   optionA: true,
 *   optionB: 42
 * });
 * ```
 *
 * @see {@link relatedFunction} For related functionality
 * @see {@link ./related-file.ts} For related module
 * @see mind/knowledge/domain/topic.md - Domain knowledge
 */
```

### Example

```typescript
/**
 * Retrieves the complete current state of the Bizing mind
 *
 * Parses standup.md, feedback.md, and INDEX.md to compile a holistic
 * view of current focus, pending tasks, blockers, and recent learnings.
 * This is the primary entry point for Bizing AI to understand its context.
 *
 * @param includeArchive - Whether to include archived tasks (default: false)
 * @returns Object containing:
 *   - currentFocus: Primary goal from standup
 *   - topTasks: Array of pending tasks (max 5)
 *   - blockers: Array of blockers with #blocker tag
 *   - recentLearnings: Array of learnings from feedback
 *   - projectStatus: Overall status from INDEX
 *
 * @throws Error if core mind files are missing or corrupted
 *
 * @example
 * ```typescript
 * // Standard usage in LLM system prompt
 * const mindState = getCompactMindState();
 * console.log(mindState.currentFocus);
 * // → "Building Bizing AI mind awareness"
 * ```
 *
 * @see {@link queryMindTasks} - For detailed task queries
 * @see {@link getMindFile} - For reading specific files
 * @see mind/symbiosis/standup.md - Source of focus data
 * @see mind/symbiosis/feedback.md - Source of learnings
 */
export function getCompactMindState(includeArchive = false): {
  currentFocus: string
  topTasks: string[]
  blockers: string[]
  recentLearnings: string[]
  projectStatus: string
} {
  // Implementation...
}
```

---

## 🏷️ Inline Comment Tags

Use these tags consistently throughout code:

| Tag | Meaning | Example |
|-----|---------|---------|
| `// TODO:` | Actionable work item | `// TODO: Add rate limiting here` |
| `// FIXME:` | Known bug to fix | `// FIXME: Returns wrong value for empty arrays` |
| `// HACK:` | Temporary workaround | `// HACK: Using any type until we define schema` |
| `// NOTE:` | Important context | `// NOTE: This assumes mind files are UTF-8` |
| `// REVIEW:` | Needs review | `// REVIEW: Is this the right error handling?` |
| `// OPTIMIZE:` | Performance issue | `// OPTIMIZE: This is O(n²), could be O(n)` |
| `// IDEA:` | Future enhancement | `// IDEA: Could cache this result` |

### Multi-line blocks

```typescript
/*
 * TODO: Implement proper error handling for malformed markdown
 * Currently throws generic Error, should be MindParseError
 * See: https://github.com/ameernuri/bizing/issues/42
 */

/*
 * NOTE: We use regex for wiki link parsing because:
 * 1. Speed - regex is faster than full markdown parser
 * 2. Simplicity - we only need links, not full AST
 * 3. Compatibility - works with Obsidian's specific syntax
 *
 * If we need more complex parsing, consider:
 * - remark-wiki-link
 * - unified.js ecosystem
 */
```

---

## 📊 Architecture Diagrams in Comments

For complex modules, include ASCII diagrams:

```typescript
/**
 * @architecture
 *
 * Mind Discovery Flow:
 * ```
 * ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │   INDEX.md  │────→│  buildMindMap() │────→│  MindNode[]     │
 * └─────────────┘     └─────────────────┘     └─────────────────┘
 *                              │
 *                              ↓
 * ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │   MAP.md    │────→│  parseMapFile() │────→│  Enrich nodes   │
 * └─────────────┘     └─────────────────┘     │  with metadata  │
 *                                             └─────────────────┘
 * ```
 *
 * Data Flow:
 * 1. Read entry point (INDEX.md)
 * 2. Extract wiki links [[path|title]]
 * 3. Recursively follow links
 * 4. Parse each file for metadata
 * 5. Build bidirectional link graph
 */
```

---

## 🔄 Documentation Workflow

### When Creating a New File

1. **Before writing code**: Add the file header with:
   - Clear `@fileoverview`
   - Architecture context with proper links
   - Known TODOs (even if empty array)

2. **While writing code**: Add function docs as you write

3. **Before committing**: Review and update:
   - Are all exports documented?
   - Are TODOs still accurate?
   - Update `@last-modified` date
   - Check that links work in VS Code

### When Modifying a File

1. **Update the header**:
   - `@last-modified` timestamp
   - Add new TODOs discovered
   - Update `@version` if significant change
   - Update related file links if dependencies changed

2. **Update function docs** if:
   - Signature changed
   - Behavior changed
   - New edge cases discovered

3. **Check related files**: Update their architecture sections if dependencies changed

### When Deleting Code

1. Remove TODOs related to deleted code
2. Update architecture docs in related files
3. Document why in commit message

---

## 🎓 Integration with Bizing Mind

### How Docs Flow into Embeddings

```
Code File → JSDoc Extraction → Text Chunks → Embeddings → Semantic Search
    ↓
TODOs, architecture notes included in chunks
```

### Mind Updates Required

When you add comprehensive docs:

1. **Update `memory/sessions/YYYY-MM-DD.md`**:
   ```markdown
   ## Documentation Work
   - Added JSDoc to {@link mind-api.ts}
   - Documented architecture decisions
   - Added 5 TODOs for future work
   ```

2. **Update `symbiosis/feedback.md`**:
   ```markdown
   - [2026-02-11] **Documentation standards** — Implemented comprehensive JSDoc requirements
   ```

3. **Update relevant knowledge file**:
   ```markdown
   // In knowledge/tech/documentation-standards.md
   ## JSDoc Requirements
   - Every file needs @fileoverview
   - Every function needs @description, @params, @returns
   - TODOs must be actionable
   ```

4. **Update MAP.md** if you created new documentation files

5. **Update project kanban** to mark docs as done

---

## ✅ Documentation Checklist

Before committing code changes:

- [ ] File header exists with `@fileoverview`
- [ ] Architecture section with related files (using proper linking)
- [ ] Mind file references use `mind/path/to/file.md` format
- [ ] All exported functions have JSDoc
- [ ] All parameters documented
- [ ] Return values documented
- [ ] TODOs are specific and actionable
- [ ] Related code files use `{@link ./file.ts}`
- [ ] Related mind files use `mind/path/file.md`
- [ ] Examples provided for complex functions
- [ ] Mind files updated (session, feedback, knowledge)
- [ ] MAP.md updated if structure changed

---

## 🔀 Git Workflow

### Branching Strategy

**NEVER commit directly to `main`.** Always use feature branches.

```bash
# 1. Create feature branch from main
git checkout main
git pull
git checkout -b feature/descriptive-name

# 2. Do the work
# - Write code
# - Add JSDoc documentation
# - Update mind files

# 3. Commit together
git add apps/api/src/ mind/
git commit -m "feat: description

- Code changes with JSDoc
- Updated symbiosis/feedback.md
- Updated symbiosis/standup.md
- Added session log"

# 4. Push and PR
git push -u origin feature/descriptive-name
# Create PR on GitHub
```

### Branch Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/bizing-mind-awareness` |
| Bug Fix | `fix/description` | `fix/api-auth-error` |
| Documentation | `docs/description` | `docs/readme-update` |
| Refactor | `refactor/description` | `refactor/extract-services` |

### Commit Message Format

```
type: short description

- Detailed change 1
- Detailed change 2
- Mind updates made
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `refactor:` — Code restructuring
- `test:` — Adding tests
- `chore:` — Maintenance

### The Golden Rule

**Code + Mind changes go in the SAME commit.**

**⚠️ ABSOLUTE RULE: NEVER commit to main**

```bash
# GOOD: Feature branch with tests passing
git checkout -b feature/descriptive-name
# ... make changes ...
tsc --noEmit  # Zero errors
vitest run    # All pass
git add .
git commit -m "feat: description"
git push -u origin feature/descriptive-name
# Create PR

# BAD: Committing to main
git checkout main  # ❌ NEVER DO THIS
git commit -m "fix"  # ❌ VIOLATION
```

**Pre-Commit Safety Check:**
```bash
# Always run before committing
git status  # Are you on main? STOP.

if [ $(git branch --show-current) = "main" ]; then
  echo "❌ STOP! You are on main branch."
  echo "✅ Do: git checkout -b feature/new-branch"
  exit 1
fi
```

**The Safe Pattern:**
1. Always start on feature branch
2. Never checkout main during active work
3. Commit to feature branch only
4. Push and PR when ready

```bash
# Never change to main during work session
git checkout main && git pull  # Only at START of new session
git checkout -b feature/xxx    # ALWAYS do this
# ... work ...
git commit feature/xxx         # Always safe
```

---

## Pre-Commit Checklist

Before every commit:

- [ ] **NOT on main branch** — `git branch` shows feature/xxx
- [ ] Code is documented (JSDoc)
- [ ] TODOs added for future work
- [ ] Tests pass
- [ ] Mind files updated:
  - [ ] `symbiosis/feedback.md` — Learnings
  - [ ] `symbiosis/standup.md` — Status
  - [ ] `memory/sessions/` — If significant work
- [ ] On feature branch (not main)
- [ ] Commit message follows format

---

## 🐙 GitHub CLI Setup

Enable PR creation from terminal.

### Installation
```bash
# macOS
brew install gh

# Linux
brew install gh  # or apt install gh

# Verify
gh --version
```

### Authentication
```bash
# Option A: Environment variable (recommended)
export GH_TOKEN=ghp_your_personal_access_token

# Option B: Interactive login
gh auth login

# Verify
gh auth status
```

**Generate Token:**
→ https://github.com/settings/tokens
- Scopes: `repo`, `read:org`

### Creating PRs

```bash
# After pushing feature branch
gh pr create --title "feat: description" --body "PR description"

# With template
gh pr create --title "feat: description" --body-file PR_TEMPLATE.md

# Edit PR in browser
gh pr create --edit

# View PRs
gh pr list
gh pr view 123
gh pr checkout 123  # Switch to PR branch
```

### CODESYNC with GitHub CLI

```bash
# Complete workflow
git checkout -b feature/xxx
# ... make changes ...
git add .
git commit -m "feat: description"
git push -u origin feature/xxx
gh pr create --title "feat: description" --body "Changes:
- Feature 1
- Feature 2
- Mind updates"

# Check PR status
gh pr status
```

### GitHub CLI Useful Commands

| Command | Description |
|---------|-------------|
| `gh pr list` | List open PRs |
| `gh pr view 123` | View PR #123 |
| `gh pr create` | Create PR (uses template) |
| `gh pr checkout 123` | Checkout PR branch |
| `gh pr merge 123 --admin --delete-branch` | Merge PR |
| `gh issue list` | List issues |
| `gh run list` | List workflow runs |

### PR Template

Create `.github/PULL_REQUEST_TEMPLATE.md` for consistent PRs.

---

## 🧪 Testing Requirements

**NO COMMIT OR PUSH if tests fail. PERIOD.**

### Required Checks Before Every Commit

1. **Type Checking**
   ```bash
   # Check for TypeScript errors
   pnpm typecheck
   # or
   tsc --noEmit
   ```
   - [ ] Zero type errors
   - [ ] Zero type warnings (ideally)

2. **Unit Tests (Vitest)**
   ```bash
   # Run all unit tests
   pnpm test
   # or
   vitest run
   ```
   - [ ] All tests pass
   - [ ] No test failures
   - [ ] Coverage maintained/improved

3. **E2E Tests (Playwright)**
   ```bash
   # Run end-to-end tests
   pnpm test:e2e
   # or
   playwright test
   ```
   - [ ] All E2E tests pass
   - [ ] No flaky tests
   - [ ] Screenshots match (if visual testing)

### Pre-Commit Checklist (Updated)

Before every commit:
- [ ] Code is documented (JSDoc)
- [ ] TODOs added for future work
- [ ] **Type check passes** — `tsc --noEmit`
- [ ] **Unit tests pass** — Vitest
- [ ] **E2E tests pass** — Playwright
- [ ] Mind files updated:
  - [ ] `symbiosis/feedback.md` — Learnings
  - [ ] `symbiosis/standup.md` — Status
  - [ ] `memory/sessions/` — If significant work
- [ ] On feature branch (not main)
- [ ] Commit message follows format

### Test-Driven Workflow

```
Write Test → See it Fail → Write Code → See it Pass → Refactor → Commit
```

**Red-Green-Refactor:**
1. **Red** — Write failing test first
2. **Green** — Write minimal code to pass
3. **Refactor** — Clean up while tests pass
4. **Commit** — Only when all green

### Why This Matters

- **Type errors** → Runtime crashes, bad UX
- **Test failures** → Broken features, regressions  
- **Committing failures** → Broken main branch, blocked team
- **Skipping tests** → Technical debt, fear of changes

**Tests are the safety net. Don't remove the net.**

---

## CODESYNC

When user says **"codesync"** or ready to commit:

```
Type Check → Run Tests → IF ALL PASS → Commit → Push → Create PR
```

**Steps:**
1. `tsc --noEmit` — Zero type errors
2. `vitest run` — All unit tests pass
3. `playwright test` — All E2E tests pass
4. **IF ALL PASS:**
   - Commit with code + mind changes
   - Push to feature branch
   - Create PR
5. **IF ANY FAIL:** — DO NOT COMMIT

**CODESYNC = Check → Test → Commit → Push → PR (all or nothing)**

---

## MINDSYNC Levels

### SOFT MINDSYNC (Every Change)
Light update after every work session:
- [[symbiosis/feedback]] — Learnings, rules
- [[symbiosis/standup]] — Status if changed
- Brief notes if significant

### HARD MINDSYNC (Big Events / Explicit)
Extensive update for:
- Major features completed
- Workflow changes
- Architecture updates
- Explicit "mindsync" command

**Includes:**
- [[symbiosis/feedback]] — Detailed learnings
- [[symbiosis/standup]] — Task status, blockers
- [[memory/sessions/YYYY-MM-DD]] — Full session log
- [[knowledge/]] files — Architecture patterns
- [[MAP]] — If structure changed
- [[backlog]] — Kanban updates
- Any other relevant files

### MINDSYNC Checklist

- [ ] feedback.md updated with learnings
- [ ] standup.md updated with status
- [ ] Session log created/updated
- [ ] Knowledge files updated (architecture, domain)
- [ ] Skills documented (if new patterns)
- [ ] MAP.md updated (if structure changed)
- [ ] Kanban board updated (backlog.md)
- [ ] **Mindful links created** — Added `[[wikilinks]]` to connect related files
- [ ] Cross-references added
- [ ] Links verified working

---

## Link Creation Guidelines

**Why Links Matter:**
- Creates the "edges" in your mind graph
- Enables semantic discovery via wikilinks
- Connects related concepts across files
- Makes navigation intuitive

**When to Link:**
- When a file mentions concepts from another file
- When adding new knowledge that relates to existing files
- When creating session logs that reference previous work
- When documenting patterns that extend existing ones

**Mindful Linking:**
```markdown
- Good: "See [[skills/workflow/documentation-standards]] for details"
- Good: "Building on [[knowledge/domain/startup-builder]]"
- Good: "Related to [[memory/sessions/2026-02-11]]"
- Avoid: "Click here [[some-random-file]]" (no context)
- Avoid: "Link everything [[to/everything]]" (over-linking)
```

**Link Strategy:**
1. Read the file you're updating
2. Identify concepts that exist elsewhere
3. Add wikilinks with descriptive text
4. Verify links point to existing files
5. Don't link for the sake of linking — link purposefully

---

## 📖 Example: Fully Documented Module

```typescript
/**
 * @fileoverview Semantic search for mind content using OpenAI embeddings
 *
 * @description
 * This module provides AI-powered semantic search across all mind content.
 * It chunks markdown files by section, generates embeddings via OpenAI API,
 * and uses cosine similarity to find relevant content by meaning rather
 * than keyword matching.
 *
 * @architecture
 * Related code files:
 * - {@link ./mind-map.ts} - File discovery and chunking
 * - {@link ../server.ts} - API endpoints for search
 * 
 * Related mind files:
 * - mind/skills/workflow/documentation-standards.md - This guide
 * - mind/knowledge/tech/ai-embeddings.md - How embeddings work
 * 
 * Used by:
 * - {@link ../server.ts} - /api/v1/mind/semantic-search endpoint
 * - {@link ./llm.ts} - semanticSearch() function calling
 *
 * @design-decisions
 * - text-embedding-3-small: Balance of quality and cost
 * - Chunk by headers: Preserves context better than fixed-size
 * - In-memory store: Fast for current scale, can upgrade to vector DB
 * - Auto-rebuild: Detects file changes via mtime
 *
 * @todo
 * - [ ] TODO: Add persistent vector store (Pinecone/Weaviate)
 * - [ ] TODO: Implement incremental updates (only changed chunks)
 * - [ ] IDEA: Add hybrid search (semantic + keyword)
 * - [ ] FIXME: Handle very large files better
 *
 * @created 2026-02-11
 * @version 1.0.0
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { getCachedMindMap } from './mind-map.js'

/**
 * Perform semantic search across all mind content
 *
 * Uses OpenAI embeddings to find content by semantic meaning rather than
 * exact keyword matching. Automatically rebuilds index if stale.
 *
 * @param query - Natural language query describing what you're looking for
 * @param topK - Number of results to return (default: 5)
 * @returns Array of search results with similarity scores
 * @throws Error if OPENAI_API_KEY not set or API fails
 *
 * @example
 * ```typescript
 * // Find startup builder documentation
 * const results = await semanticSearch(
 *   "how do agents build startups?",
 *   3
 * );
 * // Returns chunks from startup-builder.md with high similarity
 * ```
 *
 * @see {@link buildAndCacheEmbeddings} - For building the search index
 * @see {@link getEmbeddingStats} - For checking index status
 * @see mind/knowledge/domain/startup-builder.md - Typical search result
 */
export async function semanticSearch(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  // Implementation...
}
```

---

## 🔗 Related

- {@link mind/MIND-FRAMEWORK.md} — Mandatory workflow
- {@link mind/.templates/session-log.md} — Include doc updates in sessions
- {@link mind/skills/code/documentation.md} — Coding patterns for docs

---

*Remember: Documentation is not overhead—it's the interface between human minds and code. Write it for your future self.*

*Code and mind evolve together. Commit them together.*
