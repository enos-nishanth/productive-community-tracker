## Goals
- Announcements page inside Dashboard where admin can post updates
- Calendar page inside Dashboard that syncs with Google Calendar (best-in-class UI)
- Convert Dashboard navigation to a left sidebar with icons for each section

## Repo Context
- Dashboard currently uses top tabs for sections: Tasks, Daily Logs, Community, Group Chat, Weekly Report, Leaderboard (`src/pages/Dashboard.tsx:272-314`).
- Sidebar primitives available at `src/components/ui/sidebar.tsx` (shadcn style components). Icons available via `lucide-react`.
- Supabase client and typed schema exist; realtime patterns used in dashboard and chat.

## Database Additions (Supabase)
1. `announcements` table
- Fields: `id uuid pk`, `user_id uuid references profiles(id)`, `title text`, `content text`, `image_url text`, `pinned boolean default false`, `created_at timestamptz default now()`
- RLS: read for all; write/updates only for admin role via policy
- Realtime: enable `postgres_changes` on inserts/updates for live feed

2. `events` table (internal event mirror)
- Fields: `id uuid pk`, `title text`, `description text`, `start timestamptz`, `end timestamptz`, `all_day boolean`, `location text`, `created_by uuid references profiles(id)`, `google_event_id text`
- RLS: read for all; write/updates only for admin role
- Purpose: maintain app events and map them to Google Calendar events when admin links a calendar

3. Types
- Extend `src/integrations/supabase/types.ts` for `announcements` and `events`, plus optional RPCs like `upsert_event_google_id(event_id, google_event_id)`.

## Google Calendar Sync (Client-side)
- Use Google Identity Services (GIS) for OAuth: PKCE or implicit token flow for `https://www.googleapis.com/auth/calendar` scope
- UX flow:
  1. Admin opens Calendar tab and clicks “Connect Google Calendar”
  2. Sign in with Google and authorize calendar scope
  3. Save `calendarId` in app settings or use a configured shared calendar ID via env (`VITE_GOOGLE_CALENDAR_ID`)
  4. When admin creates/edits an event:
     - Create/Update in `events` table
     - Call Google Calendar REST:
       - Create: `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
       - Update: `PATCH .../events/{google_event_id}`
       - Delete: `DELETE .../events/{google_event_id}`
     - Store `google_event_id` in `events` row
  5. Fetch and merge:
     - Option A: Show internal `events` and optionally fetch Google events (authorized) within the selected range for a unified view

- Libraries:
  - `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/list` for premium UI
  - Alternatively `react-big-calendar` + `date-fns` (lighter), but FullCalendar provides richer UX out of the box

- Security notes:
  - Tokens kept in memory/localStorage with GIS; no secrets in repo
  - Admin-only event mutations via RLS + client checks

## UI Implementation
1. Left Sidebar Navigation inside Dashboard
- Replace top tabs with a vertical sidebar using `src/components/ui/sidebar.tsx`
- Items with icons:
  - Tasks (`Target`)
  - Daily Logs (`BookOpen`)
  - Community (`Users`)
  - Group Chat (`MessageSquare`)
  - Weekly Report (`BarChart2`)
  - Leaderboard (`Trophy`)
  - Announcements (`Megaphone`)
  - Calendar (`CalendarDays`)
- Sidebar collapsible on mobile; content area to the right displays selected section

2. Announcements Page (inside Dashboard)
- Admin-only compose dialog:
  - Fields: Title, Content, optional image upload to `post-images`
  - Pinned toggle; pinned items displayed at top
- Feed:
  - Fetch recent announcements, display cards with title, author, date, image
  - Realtime updates on insert/update
- Non-admins: read-only view

3. Calendar Page (inside Dashboard)
- UI: FullCalendar with dayGrid and list views, responsive
- Controls:
  - Connect Google (admin)
  - Create/Edit/Delete event (admin)
  - Switch views (Month/Week/Day/List)
- Data:
  - Load internal `events` from Supabase (range-aware queries)
  - If connected, fetch Google events in range and merge into view
  - On create/edit/delete, sync to Google and store `google_event_id`

## Performance and Responsiveness
- Realtime subscription only for announcements and internal events; calendar fetches are range-based
- Responsive sidebar and content; FullCalendar/DayGrid responsive styles out of the box
- Image uploads sanitized; limits enforced (e.g., 50 MB, similar to logs/posts)

## Security and Roles
- Admin gating:
  - Announcements compose and event mutations restricted to admins (client checks + RLS)
- No secrets in repo; `VITE_GOOGLE_CLIENT_ID` and optional `VITE_GOOGLE_CALENDAR_ID` configured in env

## Verification Plan
- Seed announcements and verify realtime updates for viewers
- Connect Google Calendar in a dev project; create events and confirm they appear in Google calendar (and app shows `google_event_id`)
- Test sidebar navigation across mobile, tablet, desktop
- Run lint/build and resolve issues

## Files to Add/Update
- New pages inside dashboard content:
  - `src/pages/Announcements.tsx` — list + admin compose dialog
  - `src/pages/Calendar.tsx` — FullCalendar integration, Google connect button, event CRUD
- Update `src/pages/Dashboard.tsx` — replace top tabs with sidebar navigation, render selected section
- Extend Supabase types and optional RPCs in `src/integrations/supabase/types.ts`
- Optional helpers:
  - `src/lib/google.ts` — GIS client setup and calendar REST wrappers
  - `src/lib/sidebar-items.ts` — nav items config with icons

If approved, I will implement:
- Supabase tables + policies (SQL files similar to prior additions)
- The sidebar navigation and two new dashboard pages
- Google Calendar OAuth flow and event sync using FullCalendar UI