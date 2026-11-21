# Klavo Product Experience & Personalization Architecture (UX-01)

## 1. Overview
The Klavo Product Experience & Personalization system delivers a cohesive, accessible, and user-tailored environment. It covers guided onboarding for new users, customizable dashboard widgets, scoped saved views, a global command palette with keyboard accelerators, persistent appearance & density preferences, and accessibility invariants adhering to WCAG 2.2 AA standards.

---

## 2. Personalization & Preference Governance

```
+-------------------------------------------------------+
|                    User Preferences                   |
|  - Theme: Light (lavender high contrast) / Dark (night)|
|  - Density: "comfortable" (spacious) / "compact"      |
|  - Dashboard Widgets: stats, charts, feed toggles     |
|  - Notification Preferences: categories, quiet hours  |
+---------------------------+---------------------------+
                            |
           +----------------+----------------+
           |                                 |
           v                                 v
+-----------------------+         +-----------------------+
|  Personal Scopes      |         |  Workspace Scopes     |
|  - Local / Profile    |         |  - Shared Views       |
|  - Recent Searches    |         |  - Team Templates     |
|  - Saved Views (isShared=false) | - Saved Views (isShared=true)
+-----------------------+         +-----------------------+
```

---

## 3. Core Capabilities

### 3.1 Guided Onboarding
- `OnboardingChecklist.jsx` provides role-specific guidance steps (Create team, Create project, Create task, Invite team member, Explore shortcuts).
- `FirstLoginWizardModal.jsx` auto-detects first-login users and guides them through workspace setup.
- Progress is stored persistently on the user profile (`User.onboarding`) and synchronized with the frontend via `OnboardingContext.jsx`.

### 3.2 Personalized Dashboard Widgets
- Users can dynamically show/hide dashboard components (`stats`, `charts`, `feed`) via the dashboard customization control bar.
- Configurations are cached in local client storage with immediate reactive updates.

### 3.3 Saved Views with Multi-Tenancy Scoping
- Filter and sorting presets can be stored as either **Personal Views** (`isShared: false`, visible only to the creator) or **Project Views** (`isShared: true`, available to all project members).
- Grouping presets (`status`, `priority`, `assignee`, `milestone`, `sprint`) preserve column layouts across device sessions.

### 3.4 Global Command Palette & Keyboard Shortcuts
- Accessible globally via `Cmd + K` / `Ctrl + K`.
- Provides rapid navigation to workspaces, projects, boards, documents, and settings.
- Features case-insensitive fuzzy filtering, arrow-key navigation, Enter activation, and Escape dismissal.

### 3.5 Display Density & Contrast Standards
- Support for `density-comfortable` (standard spacious padding) and `density-compact` (dense data-rich tables).
- Color contrast ratios verified for WCAG 2.2 AA (>= 4.5:1 body, >= 3:1 large text):
  - Light theme: `#0F172A` on `#FFFFFF` (~16:1 ratio).
  - Dark theme: `#F8FAFC` on `#0F172A` (~18:1 ratio).
