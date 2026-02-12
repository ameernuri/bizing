# Rules

> Coding standards, conventions, and guidelines. Updated 2026-02-08.

## Surgical Changes

Edit only what's needed. Don't refactor unrelated code.

**Good**:
- Fix a type error in one file
- Add a single feature flag
- Update one component's props

**Bad**:
- "While I'm here, let me clean up..."
- Changing styling of untouched components
- Refactoring to different patterns

## JSDoc Required

All code must have descriptive JSDoc comments.

**Files must have**:
- Top-level file documentation (purpose, exports)
- Function documentation (params, returns, behavior)
- Class/interface documentation (purpose, usage)
- Type documentation (purpose, structure)

**Example**:

```tsx
/**
 * Dashboard page component displaying stats and recent bookings.
 * 
 * Fetches data from the API on mount and renders a responsive
 * layout with stat cards, booking table, and real-time logs panel.
 * 
 * @returns React component tree for the dashboard page
 */
export default function Dashboard() {}

/**
 * Formats a currency amount for display.
 * 
 * @param amount - The numeric amount to format
 * @param currency - ISO currency code (default: USD)
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number, currency = 'USD'): string {}
```

**Why JSDoc**:
- Self-documenting code
- IDE tooltips
- API generation ready
- Context for future maintainers

## Shadcn First

Use shadcn/ui components by default.

```bash
cd apps/admin
npx shadcn@latest add [component]
```

Components live in `apps/admin/src/components/ui/`.

## Styling

Keep styling minimal. Use utility classes.

- Default shadcn styling
- Tailwind utilities for layout/spacing
- Global CSS for theming (dark/light modes)
- Don't create custom theme layers

## Dark Mode

Class-based toggle:

```tsx
document.documentElement.classList.remove('light', 'dark')
document.documentElement.classList.add(theme)
```

ThemeProvider:

- `'use client'` required
- Handle SSR (check `mounted`)
- Optional chaining for browser APIs:

```tsx
document?.documentElement?.classList?.add(theme)
localStorage?.setItem('theme', theme)
```

## Type Safety

Run type check before commit:

```bash
cd apps/[name] && pnpm tsc --noEmit
```

Zero type errors required for API and Admin packages.

## React Flow Nodes

```tsx
import { NodeProps } from '@xyflow/react'

export function EntityNode(props: NodeProps) {
  const entity = props.data?.entity as EntityType | undefined
  // ...
}
```

## Imports

```tsx
// shadcn
import { Button } from '@/components/ui/button'

// shared
import SchemaGraph from '@/components/SchemaGraph'
import { useTheme } from '@/components/ThemeProvider'
```

## Port Numbers

- **6129** - API (browser-safe, 6000 is blocked)
- **9000** - Admin dashboard

## Related

- [[WORKFLOW]] - How work happens
- [[01-design/VISION]] - Product direction
- [[01-design/FEATURE_SPACE]] - Feature backlog

---
*Last updated: 2026-02-11*
