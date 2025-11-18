## Features
- Announcements page inside Dashboard (admin posts; everyone reads; realtime updates)
- Calendar page inside Dashboard with Google Calendar sync and a polished UI using react-day-picker
- Convert Dashboard navigation to a left sidebar with icons for each section

## Data and Security
- Add Supabase tables with RLS:
  - announcements: id, user_id, title, content, image_url, pinned, created_at; read all, write/update admin
  - events: id, title, description, start, end, all_day, location, created_by, google_event_id; read all, write/update admin
- Extend Supabase types for these tables
- Optional RPC for event-google id upsert if needed

## UI Work
- Sidebar in Dashboard: icons for Tasks, Logs, Community, Chat, Weekly Report, Leaderboard, Announcements, Calendar
- Announcements page: compose dialog (Title, Content, Image, Pin), feed list, realtime updates
- Calendar page: react-day-picker monthly grid, event list, admin create/edit/delete, Google connect button; show internal events and optionally Google events when connected

## Google Calendar
- Use your client ID for OAuth (VITE_GOOGLE_CLIENT_ID)
- Admin clicks Connect; obtain token with calendar scope
- Event mutations sync to Google when token present; store google_event_id

## Verification
- Apply SQL in Supabase
- Build and lint; test across devices
- Confirm sidebar navigation and page content work

If approved, I will implement the tables and policies, extend types, create the Announcements and Calendar pages, and add the sidebar navigation in Dashboard.