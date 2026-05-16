# Pattern Archive

[![Netlify Status](https://api.netlify.com/api/v1/badges/93f34818-b89e-45e7-b4d6-39cf94017d94/deploy-status)](https://app.netlify.com/projects/pattern-hub/deploys)

This app is built in Vite, React, Typescript, and the new React Compiler. It uses MUI for the component library, Tanstack Router for routing, Tanstack Query for API caching, and Pocketbase for the backend.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I51RLS9K)

Links:

- [https://vite.dev/](https://vite.dev/)
- [https://react.dev/](https://react.dev/)
- [https://www.typescriptlang.org/](https://www.typescriptlang.org/)
- [React Compiler](https://react.dev/learn/react-compiler)
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [https://tanstack.com/router/latest](https://tanstack.com/router/latest)
- [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- [https://mui.com/](https://mui.com/)

# Project Specification

## Overview

**Pattern Archive** is a web app for discovering, viewing, downloading, and managing locally hosted and externally linked stained-glass patterns. Users browse a curated archive of SVG patterns contributed by the community, favorite them, mark them as completed, rate them, and export print-ready files at custom sizes. Admins manage patterns, tags, authors, FAQ content, users, and complaints through a dedicated admin panel.

### Primary user goals
- Search/browse the pattern catalog by name, tag, author, and free text
- View a pattern's detail (preview, metadata, author, tags, stats)
- Favorite and "mark as done" patterns; rate them 1–5 stars
- Export patterns as PDF/SVG at custom print sizes (single-page poster or tiled 8.5×11 sheets)
- Report problem patterns
- Maintain a public-facing user profile showing favorites, completed, rated, and a photo gallery

### Primary admin goals
- CRUD on patterns (hosted SVGs + external links to third-party sites)
- Bulk-manage tags (global rename, delete, merge)
- CRUD on authors
- Manage FAQ pages via markdown editor
- Manage users (ban, promote, demote)
- Manage admin roles with granular permission assignment (Transfer List UI)
- Review and action complaints submitted via the report-pattern flow
- View dashboard stats (user counts, favorites, done counts, etc.)

## Tech Stack

### Design system conventions
- **Color scheme**: clean white background with green as primary accent. Soft neutrals for secondary text, subtle dividers, and generous whitespace.
- **Typography**: MUI default variants (`h1`–`h6`, `body1`, `body2`, `caption`) with weight adjustments for emphasis. Titles often use `fontWeight={600}` or `700`.
- **Radii**: rounded — cards/inputs typically `borderRadius: 2–3` (MUI theme spacing), images/tiles around `12–14px`.
- **Elevation**: prefer flat `elevation={0}` with subtle borders over heavy drop shadows.
- **Spacing**: MUI `spacing` scale, containers generally `maxWidth="lg"` with `px: { xs: 2, md: 4 }` padding.

## Data Model (PocketBase Collections)

### `patterns`
Primary collection holding both self-hosted and external patterns.

| Field                        | Type                                     | Notes                                                   |
|------------------------------|------------------------------------------|---------------------------------------------------------|
| `id`                         | string (PB)                              |                                                         |
| `name`                       | text                                     |                                                         |
| `description`                | text                                     |                                                         |
| `difficulty`                 | text/select                              | e.g. Beginner / Intermediate / Advanced                 |
| `authors`                    | relation (multi) to `authors` collection |                                                         |
| `author_manual`              | text[]                                   | Free-text authors not in `authors` collection           |
| `uploaded_by`                | relation to `users`                      |                                                         |
| `tags`                       | JSON array of strings                    | Flat tag array, no separate tags table                  |
| `pattern_file`               | file (SVG or WebP)                       | Self-hosted pattern asset                               |
| `pattern_file_external`      | text                                     | Boolean flag — is this an external pattern              |
| `pattern_file_external_link` | text                                     | URL to external source if external                      |
| `opengraph_image`            | file                                     | Generated 1200×630 OG image for social sharing          |
| `pieces`                     | number                                   | Number of glass pieces                                  |
| `design_width`               | number                                   | True pattern width (NOT canvas width)                   |
| `design_height`              | number                                   | True pattern height                                     |
| `line_width`                 | number                                   | Stroke width in design units                            |
| `design_width_unit`          | text                                     | `in`, `cm`, `mm`, etc.                                  |
| `design_height_unit`         | text                                     |                                                         |
| `line_width_unit`            | text                                     |                                                         |
| `source_site_name`           | text                                     | For external patterns, e.g. "Stained Glass Pattern Co." |
| `license`                    | text                                     | CC BY, All Rights Reserved, Unknown, etc.               |
| `permission_status`          | select                                   | granted / assumed / unknown                             |
| `created` / `updated`        | datetime                                 | PB auto fields                                          |

**Important SVG convention**: pattern content is wrapped in `<g id="pattern" data-width-units="..." data-height-units="...">`. Non-pattern extras (ruler, labels) are siblings and may be marked `class="export-ignore"`. Export pipeline strips non-pattern content before scaling.

### `authors`

| Field    | Type            |
|----------|-----------------|
| `id`     | string          |
| `name`   | text            |
| `bio`    | text (optional) |
| `avatar` | file (optional) |

### `users` (PocketBase `_pb_users_auth_`)

Standard PB auth fields + custom:

| Field                                     | Type                                                  |
|-------------------------------------------|-------------------------------------------------------|
| `username`, `email`, `avatar`, `verified` | PB defaults                                           |
| `about`                                   | text                                                  |
| `interests`                               | text[]                                                |
| `is_banned`                               | boolean                                               |
| `role`                                    | select: user / editor / manager / admin / super_admin |
| `level`                                   | text[] (permission codes)                             |

### `user_favorites`

| Field        | Type     |
|--------------|----------|
| `pattern_id` | relation |
| `owner_id`   | relation |
| `created`    | datetime |

### `user_done`
Same shape as `user_favorites` — records that a user has completed a pattern.

### `user_ratings`

| Field          | Type         |
|----------------|--------------|
| `pattern_id`   | relation     |
| `owner_id`     | relation     |
| `rating`       | number (1–5) |
| `rating_notes` | text         |

### `pattern_ratings_summary` (PocketBase SQL View)
Aggregates average ratings. Query:
```sql
SELECT pattern_id AS id,
       AVG(rating) AS average_rating,
       COUNT(*) AS total_ratings
FROM user_ratings
GROUP BY pattern_id
```

### `gallery`

User-uploaded progress/completion photos tied to a pattern.

| Field         | Type                |
|---------------|---------------------|
| `owner_id`    | relation            |
| `pattern_id`  | relation (optional) |
| `src`         | string              |
| `title`       | string              |
| `description` | string              |
| `created`     | datetime            |

### `faq_pages`

| Field         | Type            |
|---------------|-----------------|
| `title`       | text            |
| `slug`        | text (unique)   |
| `content`     | text (markdown) |
| `order`       | number          |
| `published`   | boolean         |

### `complaints`

| Field         | Type                                                |
|---------------|-----------------------------------------------------|
| `pattern_id`  | relation                                            |
| `reporter_id` | relation (nullable)                                 |
| `reason`      | select (broken file, copyright, low quality, other) |
| `notes`       | text                                                |
| `status`      | select (open / in_review / resolved / dismissed)    |
| `created`     | datetime                                            |

---

## Routes

File-based TanStack Router. Search params are validated with Zod schemas.

### Public routes

| Path              | Purpose                                                                                                |
|-------------------|--------------------------------------------------------------------------------------------------------|
| `/`               | Homepage — pattern search and grid. Side drawer shows a pattern's detail when `?patternId=xxx` is set. |
| `/pattern/$id`    | Full-page pattern detail view (SEO-friendly canonical URL).                                            |
| `/profile`        | Current user's profile (if authed).                                                                    |
| `/profile?id=xxx` | Public read-only view of any user.                                                                     |
| `/faq`            | FAQ index with accordion of published pages.                                                           |
| `/faq/$slug`      | Individual FAQ page rendered from markdown.                                                            |
| `/login`          | Email/password + any PB OAuth providers.                                                               |
| `/signup`         | Registration.                                                                                          |
| `/error`          | Global error page (TanStack `defaultErrorComponent`).                                                  |
| `/404`            | Not found.                                                                                             |

### Admin routes (`/admin/*`, permission-gated)

| Path                                                 | Purpose                                                         |
|------------------------------------------------------|-----------------------------------------------------------------|
| `/admin`                                             | Dashboard — 6 stat cards + top-5 patterns table.                |
| `/admin/patterns`                                    | DataGrid of all patterns with CRUD.                             |
| `/admin/patterns/new` and `/admin/patterns/$id/edit` | Pattern form.                                                   |
| `/admin/tags`                                        | Tag management (bulk rename, delete, merge).                    |
| `/admin/authors`                                     | Author table with CRUD.                                         |
| `/admin/faq`                                         | Three-pane markdown editor (page list + meta + editor/preview). |
| `/admin/users`                                       | User table with ban/unban, role toggle, per-user stats.         |
| `/admin/admins`                                      | Admin roster with Transfer List for permissions.                |
| `/admin/complaints`                                  | Queue of submitted reports.                                     |
| `/admin/map`                                         | (Future / optional) — geographic feature.                       |

### Homepage search schema (`/`)

```ts
const patternSearchSchema = z.object({
  q:         z.string().default(''),         // free-text search
  tags:      z.array(z.string()).default([]),
  authors:   z.array(z.string()).default([]),
  patternId: z.string().optional(),          // opens detail drawer
  page:      z.number().int().min(1).default(1),
});
```

Example URL: `/?q=floral&tags=Sun+Catcher&tags=Large+Horse&authors=Claycorp&page=2`.

---

## Screen-by-Screen Specification

### Homepage (`/`)

**Layout**: standard top nav, centered column.

**Components (top to bottom)**:
1. **Hero section** — wordmark, short tagline, optional decorative SVG flourish. Not oversized; modest hero to keep archive above the fold on larger screens.
2. **Tokenized search bar** — single focusable element that visually combines:
  - Free-text terms (e.g. `horse`, `-dog` for exclusion)
  - Tag chips (e.g. `[Sun Catcher ×]`) rendered as pills with a remove button
  - Author chips prefixed `author:` when typed
  - On Enter, raw text becomes a text token; clicking a sidebar tag appends a tag token.
3. **Filter sidebar (left, desktop) / drawer (mobile)**:
  - Tag list with counts, clickable to toggle as tag tokens
  - Author list with counts
  - Difficulty filter (chips)
4. **Results grid** — responsive card grid. Each card:
  - Thumbnail (SVG render or OG image for external patterns)
  - Name (truncated)
  - Author(s)
  - Favorite count + heart icon; Done count + checkmark
  - Difficulty chip (colored)
  - Star rating (average)
  - "External" badge if `pattern_file_external` is true
5. **Pagination** — MUI `Pagination` at bottom, URL-synced via `page` param.
6. **Detail drawer** — right-side drawer opens when `patternId` set. Shows abbreviated detail with a "Full page" link to `/pattern/$id`.

**Empty / loading / error states**:
- Empty: illustration + "No patterns match your filters. Clear filters."
- Loading: skeleton cards matching grid shape.
- Error: centered stained-glass themed error card with retry.

### Pattern Detail (`/pattern/$id`)

**Two-column layout on desktop; stacked on mobile.**

**Top bar**:
- Previous / Next buttons navigating between sibling patterns in the current search context.

**Left column (2/3 width)**:
- Large SVG preview with zoom/pan support. Shows the `#pattern` group; extras (ruler, labels) visible but clearly secondary.
- Below preview: **Export panel**
  - Page width / page height inputs (accept `in`, `cm`, `mm`, `ft`, `px`)
  - Landscape / Portrait toggle
  - Output mode toggle: **Single-page PDF** (poster) vs **Tiled 8.5×11 sheets**
  - Live summary: e.g. "Your 10×20in pattern will export as 12×28in image (includes ruler). Line thickness preserved."
  - For tiled: live sheet count ("6 sheets — 2 columns × 3 rows")
  - Big green "Download" CTA
- For external patterns: Export panel is replaced by a prominent "View on {source_site_name} →" button; no download.

**Right column (1/3 width)**:
- Title (h3/h4)
- Description paragraph
- Pattern ID (muted, copy-on-click)
- Favorite button with count; toggles filled/outlined heart
- "Mark as done" button with count
- MUI `Rating` component — current user's rating + average display
- Report button (opens modal)
- Metadata list:
  - Line width (with unit)
  - Design width × height (with units)
  - Pieces count
  - Difficulty chip
- Author(s) — clickable chips linking to filtered homepage
- Uploaded by — avatar + username linking to their profile
- Tags — clickable chips

### Profile (`/profile`, `/profile?id=xxx`)

**Hero banner** — decorative green gradient band, ~200px tall.

**Profile card** — overlaps bottom of hero by ~60px:
- Avatar (96px circular)
- Username, joined-date
- About text
- Interests as chips
- Stat tiles (favorites, completed, rated, photos) — 72×72 rounded tiles
- Own profile only: edit button

**Tabbed content** below card (MUI Tabs):
- **Favorites** — grid of pattern cards (same card component as homepage)
- **Completed** — same grid, different dataset
- **Rated** — grid with user's rating visible on each card
- **Gallery** — masonry image grid of user-uploaded photos, click for lightbox

**Loading state**: `ProfileSkeleton` matching layout — hero skeleton, profile card skeleton with text/avatar placeholders, grid skeleton tiles.

**Error state** (user not found): same layout, error card with `PersonOffOutlinedIcon`, "Profile not found" title, secondary text, retry button.

**Public view differences**: no edit button; sensitive tabs may be hidden depending on privacy config.

### FAQ (`/faq`, `/faq/$slug`)

- `/faq`: accordion list of all published pages ordered by `order` field. Each expands to show rendered markdown.
- `/faq/$slug`: single page view, article-style typography, table of contents on desktop (right rail).

### Admin Dashboard (`/admin`)

**Sidebar nav** (collapsible, icon-only mode with 220ms transition):
- Dashboard / Patterns / Tags / Authors / FAQ / Users / Admins / Complaints / Map
- Badge counts next to Complaints (open count)
- Current user at bottom

**Main content**:
- **6 stat cards** in a responsive grid (1/2/3/6 cols): Users, Patterns, Favorites, Done, Tags, Authors. Each has value, label, small trend indicator (% change).
- **Top 5 patterns table** — sorted by favorites. Columns: thumbnail, name, author, favorites, done, rating.

### Admin — Patterns (`/admin/patterns`)

MUI X `DataGrid`:
- Search input above grid
- Columns: thumbnail, name, difficulty chip (colored: green Beginner / amber Intermediate / red Advanced), author, favorite count, done count, tags preview, created date, actions (edit / delete)
- Delete opens confirmation dialog
- "Add Pattern" button top right → opens form (new route or dialog)

**Pattern form fields** follow the `patterns` schema. File upload area accepts SVG and WebP. Preview panel renders the uploaded file. For external patterns, toggle hides the file upload and reveals external URL + source site name + license fields.

### Admin — Tags (`/admin/tags`)

Tags are a denormalized JSON array — no separate collection. The tool must operate across thousands of patterns in batched API calls.

**Layout**:
- Header with total unique tag count + total patterns tagged
- **Tag list** — searchable, sortable pill cards showing tag name + usage count + delete button
- **Actions panel** on the right:
  - Global Rename (old tag → new tag, shows affected count)
  - Global Delete (removes tag from all patterns)
  - Merge Tags (combine tag A + tag B → new canonical name)
  - Add new tag (no-op unless immediately attached to patterns, so more of a "preflight" entry)
- **Progress modal** during bulk operations — progress bar with current batch / total batches, cancel button
- Batch size ~15, sequential await between batches to avoid hammering PocketBase

### Admin — Authors (`/admin/authors`)

Sortable table: avatar (initials), name, pattern count, bio preview, edit / delete. Add author dialog.

### Admin — FAQ Editor (`/admin/faq`)

**Three-pane layout**:
- **Left pane**: page list with drag handle for reordering, add-page button, published/draft badge
- **Top bar**: title, slug, published toggle, save button (briefly turns green on click)
- **Main pane**: markdown textarea editor. Toggle switches to live preview rendered with theme-aware inline styles.

### Admin — Users (`/admin/users`)

Table with:
- Role filter (All / User / Editor / Manager / Admin)
- Search input
- Columns: avatar, username, email, role, favorites count, done count, joined date, actions
- Ban/unban toggle — banned rows visually dimmed (reduced opacity)
- Admin promotion toggle

### Admin — Admins (`/admin/admins`)

Table of admin users. Clicking edit opens a **Permission Transfer List** (MUI Transfer List component):
- **Left column**: "Available Permissions" — all 28 codes not currently assigned
- **Right column**: "Assigned to {username}" — permissions currently on the user
- Transfer arrows between columns; multi-select with checkboxes
- Permissions can be grouped visually by resource prefix (PATTERN_*, TAG_*, etc.) with subheaders
- Save button fires `saveAdminUser(payload)` with the final array

### Admin — Complaints (`/admin/complaints`)

Table/queue:
- Status tabs: Open / In Review / Resolved / Dismissed
- Columns: reported pattern (thumbnail + name), reporter, reason, notes preview, date, status chip, actions
- Click row → detail drawer with full context, pattern link, resolution controls

---

## Key Interaction Patterns

### Tokenized search
The search bar is one cohesive control that displays a mix of text and chips. Rendering order: text tokens inline (space-separated) interleaved with tag/author chips that have a removable `×`. Backspace on empty input removes the last token. Typing `author:Claycorp` creates an author token; typing `-dog` creates an excluded text token.

### Pattern detail drawer vs full page
The homepage uses a side drawer for fast preview (`/?patternId=xxx`), while `/pattern/$id` is the shareable canonical URL. Both render the same detail component with a `layout="drawer" | "full"` prop.

### Export flow
1. User enters target width/height with unit suffix
2. System computes uniform scale ratios `scaleX = target_w / design_w`, `scaleY = target_h / design_h`
3. Aspect ratio is locked by default (height auto-fills from width using design aspect)
4. Pattern SVG is isolated from extras via `#pattern` group; extras stripped
5. Strokes rescaled so line thickness stays visually constant regardless of pattern scale
6. Output as SVG blob, raster PNG at target DPI, or tiled multi-page PDF

### Bulk tag updates
1. Fetch all patterns containing the target tag
2. Chunk into batches of ~15
3. Sequentially: fire batch concurrently, await, advance
4. Live progress UI; cancellable

### Permission gating
Routes under `/admin` check `authUser.level.includes(required_code)` via a shared route guard. Missing permission → redirect to `/admin` with a toast.

---

## Visual Language Details

### Color palette
- **Primary green**: a saturated but not neon green used for CTAs, active states, primary icons. Think "stained glass emerald" rather than system default.
- **White**: page background, card surfaces.
- **Ink**: near-black (#1a1a1a or similar) for primary text.
- **Muted**: mid-gray for secondary text (#666–#888 range).
- **Divider**: very light gray (#eee–#f0f0f0).
- **Semantic**: amber for warnings, red for destructive, green (reusing primary) for success.

### Typography
- MUI default unless overridden. Titles `fontWeight={600–700}`, body regular weight.
- Favor comfortable line-height (~1.6) and generous letter-spacing on display headings.

### Iconography
`@mui/icons-material` only — outlined variants preferred for a lighter feel. Common icons used: `FavoriteBorderOutlined`, `TaskAltOutlined`, `StarOutlined`, `PhotoLibraryOutlined`, `PersonOffOutlined`, `ZoomInOutlined`, `SaveIcon`, `ReportOutlined`.

### Card pattern
`elevation={0}` MUI Paper/Card with 1px border (`#eee` or theme divider), rounded corners (`borderRadius: 3`), padding `3–4` (MUI spacing). Hover states on interactive cards: subtle border darken + slight Y-translate.

### Chips
Tag and author chips are pill-shaped, outlined variant by default. Filled green when active/selected. Small close `×` icon for removable chips in the search bar.

### Loading patterns
MUI `Skeleton` components that mirror the final layout dimensions. Grids show 6–8 skeleton tiles; profile shows hero+card+tiles skeleton.

### Motion
- Drawer open/close: standard MUI 225ms cubic-bezier
- Sidebar collapse: 220ms CSS transition on width
- Save button "flash green": 600ms success color on click
- Hover elevations: 150ms ease-in-out

---

## State Management Conventions

- **Server data** → TanStack Query. Hooks named `useQueryGet*` and `useMutation*`.
- **URL state** (search, filters, pagination, drawer open) → TanStack Router search params with Zod validation.
- **Global UI state** (current user, theme, sidebar collapsed) → Jotai atoms.
- **Local form state** → `useState` or `react-hook-form` for complex forms.

---

## Useful Hooks & Utilities (exist in the codebase)

- `usePatternSearch()` — returns tokens, filter string for PocketBase, patternId, page, and mutation functions for all search actions (`addTag`, `addAuthor`, `toggleTag`, `nextPattern`, `prevPattern`, `setPage`, etc.)
- `useGlobalAuthData()` — current authed user from Jotai
- `useQueryGetPublicUserById(id)` — public profile fetch
- `useQueryGetUserFavoritesByUserIdAndPagination(userId, page)` — paginated user's favorites
- `generateOpengraphImage(source, patternName)` — 1200×630 canvas-rendered share image supporting SVG or WebP inputs
- `scaleSvgWithFixedStrokes(svg, scaleX, scaleY)` — pattern scaling with stroke-width compensation
- `buildPocketBaseFilter(tokens)` — converts token list to PB filter string
- `saveAdminUser(payload)` — persists admin permission updates

---

## Things to Avoid in UI

- Download buttons on external patterns (must be "View on {site}" instead)
- Hotlinking or iframing external content
- Copying external pattern descriptions verbatim
- Heavy drop shadows (prefer borders and subtle elevation)
- Generic AI color palettes (purple gradients on white, system-font-only typography)
- Nesting pattern metadata inside tooltips when a visible chip/label would be clearer
- Showing a download CTA for a pattern whose dimensions are missing — disable with explanatory text

---

## Glossary

| Term                   | Meaning                                                                  |
|------------------------|--------------------------------------------------------------------------|
| **Pattern**            | An SVG design for a stained glass piece                                  |
| **Design size**        | True intended size of the pattern, not the SVG canvas size               |
| **Canvas / file size** | Actual SVG viewBox extents, which may include rulers/labels              |
| **External pattern**   | Entry that links to a pattern hosted elsewhere; no download              |
| **Tile**               | One 8.5×11 sheet in a tiled multi-page export                            |
| **Token**              | Atomic unit in the search bar: text, tag, or author, optionally excluded |
| **OG image**           | 1200×630 share-card image generated from the pattern SVG                 |
| **Done**               | User-tracked state that they have built this pattern                     |
