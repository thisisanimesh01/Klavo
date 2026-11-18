# Klavo Design System & Component Library (UX-01)

The Klavo Design System provides a unified, consistent, accessible, and scalable UI foundation across all Klavo web surfaces. It establishes a centralized token architecture, light/dark theme semantic variables, and a suite of reusable primitive components.

---

## 1. Design Tokens Architecture

All design tokens are defined in [`frontend/src/theme/tokens.js`](file:///Users/animeshyadav/Desktop/project/Klavo/frontend/src/theme/tokens.js) and bridged to Tailwind CSS via [`frontend/tailwind.config.js`](file:///Users/animeshyadav/Desktop/project/Klavo/frontend/tailwind.config.js).

### Color Tokens
- **Brand / Primary**: Indigo scale (`50` through `900`), with `primary.600` (`#4f46e5`) as the primary interactive accent.
- **Semantic Scales**:
  - `success`: Emerald (`50` through `700`) for completed tasks, healthy status, and confirmations.
  - `warning`: Amber (`50` through `700`) for at-risk states, approaching deadlines, and alerts.
  - `danger`: Rose (`50` through `700`) for critical errors, overdue work, and destructive actions.
  - `info`: Sky (`50` through `700`) for neutral announcements, informational badges, and hints.
- **Neutrals**: Slate scale (`50` through `950`) providing high-contrast dark and light surfaces.

### Typography
- **Font Family**: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif.
- **Scale**: `xs` (12px), `sm` (14px), `base` (16px), `lg` (18px), `xl` (20px), `2xl` (24px), `3xl` (30px).

### Border Radii & Elevation
- **Radii**: `sm` (4px), `md` (6px), `lg` (8px), `xl` (12px), `2xl` (16px), `full` (9999px).
- **Elevation / Shadows**:
  - `sm`: Subtle card elevation (`0 1px 2px 0 rgb(0 0 0 / 0.05)`).
  - `md`: Default elevated containers (`0 4px 6px -1px rgb(0 0 0 / 0.1)`).
  - `lg`: Popovers and dropdown menus (`0 10px 15px -3px rgb(0 0 0 / 0.1)`).
  - `xl`: Modals and dialog overlays (`0 20px 25px -5px rgb(0 0 0 / 0.1)`).
  - `glow`: Brand-focused focus rings (`0 0 15px -3px rgba(79, 70, 229, 0.4)`).

---

## 2. Light & Dark Semantic Theme Variables

Defined in [`frontend/src/index.css`](file:///Users/animeshyadav/Desktop/project/Klavo/frontend/src/index.css) as CSS custom properties:

| Variable | Light Theme | Dark Theme (`.dark`) | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-main` | `#f8fafc` (slate-50) | `#0b0f19` | Root page background |
| `--bg-card` | `#ffffff` | `#111827` (gray-900) | Surface cards, tables, panels |
| `--bg-subtle` | `#f1f5f9` (slate-100) | `#1f2937` (gray-800) | Input backgrounds, table headers |
| `--text-main` | `#0f172a` (slate-900) | `#f9fafb` (gray-50) | Primary typography, headers |
| `--text-muted` | `#64748b` (slate-500) | `#9ca3af` (gray-400) | Subtitles, labels, placeholders |
| `--card-border` | `#e2e8f0` (slate-200) | `#1f2937` (gray-800) | Dividers, card and input borders |
| `--color-primary` | `#4f46e5` (indigo-600) | `#6366f1` (indigo-500) | Interactive accents, focus rings |

---

## 3. UI Primitive Components

Located under [`frontend/src/components/ui/`](file:///Users/animeshyadav/Desktop/project/Klavo/frontend/src/components/ui/):

### 1. `Button`
- **Variants**: `primary`, `secondary`, `outline`, `ghost`, `danger`, `success`.
- **Sizes**: `xs`, `sm`, `md`, `lg`.
- **States**: Hover, active, focus-visible ring, disabled, and loading spinner (`isLoading={true}`).
- **Usage**:
  ```jsx
  import { Button } from '../components/ui';

  <Button variant="primary" size="md" isLoading={saving} onClick={handleSave}>
    Save Changes
  </Button>
  ```

### 2. `Input`
- Standardized text, email, number, and password input with integrated label, helper text, error message, and left/right icon adornments.
- **Usage**:
  ```jsx
  import { Input } from '../components/ui';
  import { Search } from 'lucide-react';

  <Input
    label="Search Projects"
    icon={<Search className="w-4 h-4" />}
    placeholder="Filter by title..."
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    error={errors.query}
  />
  ```

### 3. `Select`
- Accessible select input with stylized chevron, custom options, error messaging, and full keyboard focus accessibility.
- **Usage**:
  ```jsx
  import { Select } from '../components/ui';

  <Select
    label="Project Category"
    options={[
      { value: 'software', label: 'Software Development' },
      { value: 'marketing', label: 'Marketing Campaign' },
    ]}
    value={category}
    onChange={(e) => setCategory(e.target.value)}
  />
  ```

### 4. `Checkbox`
- Accessible checkbox with custom SVG checkmark, hover state, focus ring, label, and optional description text.
- **Usage**:
  ```jsx
  import { Checkbox } from '../components/ui';

  <Checkbox
    label="Enable Sprint Burndown"
    description="Calculate remaining points daily"
    checked={enabled}
    onChange={(e) => setEnabled(e.target.checked)}
  />
  ```

### 5. `Badge`
- Semantic status pills with optional pulsing dot indicator.
- **Variants**: `primary`, `success`, `warning`, `danger`, `info`, `neutral`.
- **Sizes**: `xs`, `sm`, `md`.
- **Usage**:
  ```jsx
  import { Badge } from '../components/ui';

  <Badge variant="success" dot size="sm">
    Active Sprint
  </Badge>
  ```

### 6. `Avatar`
- User avatar with automatic image fallback, deterministic color generation based on user name, and optional status indicator (`online`, `busy`, `offline`).
- **Usage**:
  ```jsx
  import { Avatar } from '../components/ui';

  <Avatar name="Animesh Yadav" status="online" size="md" />
  ```

### 7. `Card` & `CardHeader`
- Reusable surface container supporting hover interactions, flexible padding (`none`, `sm`, `md`, `lg`), header sections with title, subtitle, and action slots.
- **Usage**:
  ```jsx
  import { Card, CardHeader } from '../components/ui';

  <Card hoverable padding="md">
    <CardHeader title="Sprint Velocity" subtitle="Past 5 sprints" action={<Button size="xs">Export</Button>} />
    <div>Chart content</div>
  </Card>
  ```

### 8. `Modal`
- Dialog modal with backdrop blur, fade-in animation, ESC key listener, outside click handling, and structured header/footer slots.
- **Usage**:
  ```jsx
  import { Modal, Button } from '../components/ui';

  <Modal
    isOpen={isOpen}
    onClose={() => setIsOpen(false)}
    title="Create Project"
    subtitle="Configure your new project workspace"
    footer={
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Create</Button>
      </div>
    }
  >
    <ModalContent />
  </Modal>
  ```

### 9. `EmptyState` & `LoadingState`
- Standardized empty and loading state indicators with customizable iconography, title, description, and action button.
- **Usage**:
  ```jsx
  import { EmptyState, LoadingState } from '../components/ui';

  if (loading) return <LoadingState message="Fetching sprint analytics..." />;
  if (items.length === 0) return <EmptyState title="No items found" description="Try creating one." action={<Button>New Item</Button>} />;
  ```

### 10. `Tooltip`, `Dropdown`, `Table`
- **Tooltip**: Hoverable utility label.
- **Dropdown & DropdownItem**: Accessible menu with keyboard escape and click-outside dismissal.
- **Table, TableHead, TableBody, TableRow, TableCell**: Responsive, accessible data table primitives.

---

## 4. Screen Migration Guidelines

1. Migrate screen layouts to use `Card` and `CardHeader` for structured surfaces.
2. Replace ad-hoc buttons with `Button`, mapping variant (`primary`, `secondary`, `outline`, `ghost`, `danger`) and size (`xs`, `sm`, `md`, `lg`).
3. Replace raw text inputs and selects with `Input` and `Select`, wiring `error` and `helperText`.
4. Replace raw badge spans with `Badge`.
5. Replace loading spinners and zero-item notices with `LoadingState` and `EmptyState`.
6. Replace custom modal overlays with `Modal`.

---

## 5. Responsive Mobile & Tablet Experience (UX-02)

### Breakpoint Strategy
Standardized responsive viewport breakpoints configured in `tokens.js` and `tailwind.config.js`:
- `xs: 360px` — Small mobile viewports (portrait phones, iPhone SE, compact Androids).
- `sm: 640px` — Standard mobile & phablet screens.
- `md: 768px` — Tablet portrait & split-screen desktop views.
- `lg: 1024px` — Tablet landscape & standard laptop views.
- `xl: 1280px` — Full desktop monitors.
- `2xl: 1536px` — Large ultrawide displays.

### Mobile Navigation & Layout Rules
- **Sidebar Drawer**: On mobile/tablet (`< md`), the primary sidebar transforms into an off-canvas drawer with backdrop overlay, smoothly opening via the `Topbar` hamburger button and closing automatically upon link selection or backdrop click.
- **Kanban Board**: Provides quick column tabs (`All Columns`, `Todo`, `In Progress`, `Review`, `Done`) on small screens, allowing focused single-column interactions without losing drag-and-drop or card actions.
- **Documents & Wiki Tree**: Document tree navigation operates as an off-canvas slide-out drawer on `< md` screens with a quick toggle button in the header, keeping the editor distraction-free.
- **Tables & Gantt Timelines**: Enclosed in horizontal scroll wrappers (`overflow-x-auto`) to guarantee zero page-level layout shifts or body overflow.
- **Modals & Dialogs**: Constrained to viewport-safe bounds (`max-h-[92vh]`, `p-2 sm:p-4`), with interior scrolling and safe-touch close buttons.
- **Touch Target Standard**: Primary interactive controls adhere to minimum 40px–44px touch targets on coarse pointer devices.
