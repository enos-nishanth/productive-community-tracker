## Overview
- Build a robust notifications system (DB + RPCs + RLS + realtime) with unread badges and a dedicated /notifications page
- Make the dashboard sidebar adjustable, persist width per user, and animate header logo to visually align with collapsed/expanded sidebar
- Provide accessible UI, hooks, utilities, and tests per your deliverables

## Database: Tables, Indexes, Policies
### notifications
- Columns:
  - id uuid pk default gen_random_uuid()
  - user_id uuid not null references profiles(id)
  - actor_id uuid references profiles(id)
  - type text not null check(type in ('task_deadline','weekly_report','comment','message','system'))
  - reference_id uuid
  - title text not null
  - body text
  - meta jsonb
  - is_read boolean default false
  - created_at timestamptz default now()
  - expires_at timestamptz
- Indexes:
  - create index idx_notifications_user_read_created on notifications(user_id, is_read, created_at desc)
  - create index idx_notifications_user_created on notifications(user_id, created_at desc)
  - create index idx_notifications_reference on notifications(reference_id)
  - create index if needed: gin(meta)
- RLS:
  - enable row level security on notifications
  - SELECT: user_id = auth.uid() OR admin role
  - INSERT: via SECURITY DEFINER RPC `notify_create`
  - UPDATE: allow user to set is_read on their notifications or via SECURITY DEFINER RPCs
  - DELETE: admin only

### user_ui_settings
- Columns:
  - id uuid pk default gen_random_uuid()
  - user_id uuid unique not null references profiles(id)
  - sidebar_width int not null default 280
  - sidebar_collapsed boolean default false
  - last_checked_notifications timestamptz
- Index:
  - unique(user_id)
- RLS:
  - enable RLS; SELECT/UPDATE only where user_id = auth.uid()

### message_unreads (optional denormalized)
- Columns:
  - user_id uuid not null references profiles(id)
  - thread_id uuid not null
  - unread_count int default 0
- Index:
  - create unique index on (user_id, thread_id)
- RLS:
  - enable RLS; SELECT/UPDATE only where user_id = auth.uid()

## RPCs and Triggers (Security Definer)
- notify_create(p_user_id uuid, p_actor_id uuid, p_type text, p_reference_id uuid, p_title text, p_body text, p_meta jsonb): inserts into notifications; validates type and optional dedupe per (type, reference_id, user_id, recent window)
- mark_notifications_read(p_user_id uuid, p_ids uuid[]): update is_read = true for rows where user_id = p_user_id; return unread_count
- mark_all_notifications_read(p_user_id uuid): update all rows for user; return unread_count
- get_notifications_summary(p_user_id uuid, p_limit int default 20): returns latest p_limit notifications joined with actor profile (username, avatar) plus aggregate unread_count in one query
- increment_message_unread(p_user_id uuid, p_thread_id uuid, p_delta int): upsert into message_unreads

### Triggers / jobs
- Weekly report: after insert on weekly_reports → call notify_create(user_id, admin_id, 'weekly_report', report_id, 'Weekly report ready', 'Your weekly report was created', meta)
- Comments: after insert on comments → notify post owner (unless commenter is owner) with type 'comment', reference_id=post_id; consider coalescing multiple comments by time window
- Messages: after insert on messages → increment message_unreads for recipients (group or thread participants except sender); optionally create 'message' notification
- Task deadlines: scheduled job (cron) to scan tasks where due_at between now() and now()+24h; notify owners as 'task_deadline' with meta {task_due_at, link}; dedupe by (user_id, reference_id, type, date)

## Frontend: Hooks, Utilities, Pages
### Hooks
- useSidebar()
  - state: width, collapsed, setWidth, toggle, persist()
  - reads/writes to user_ui_settings via Supabase; min/max enforced (min=200, max=420)
  - debounced persist on changes; restores on mount
- useNotifications()
  - loads get_notifications_summary(session.user.id)
  - exposes notifications[], unreadCount, markRead(ids), markAllRead()
  - subscribes to notifications INSERT/UPDATE for user; updates in realtime
- useRealtimeCounts()
  - subscribes to message_unreads (or messages) and computes unreadMessageCount; used for chat badge
- formatRelativeDate(date): returns user-friendly timestamp (e.g., Today, Yesterday, relative time)

### Sidebar (adjustable + persisted)
- Add draggable rail handle (mouse + keyboard +/-) with aria roles
- Enforce min/max width and update CSS variable `--sidebar-width`
- Persist to user_ui_settings; restore on mount
- Collapsed state toggled; when collapsed, show icon-only; aria-expanded reflects state

### Header Logo Behavior
- HeaderLogo component listens to useSidebar()
- Applies transform (translateX or margin-left) with CSS transition to visually align with collapsed/expanded sidebar; respects prefers-reduced-motion

### Notifications UI
- /notifications route
  - Paginated list, filter by type, search
  - Grouped by date sections (Today, Yesterday, Earlier)
  - Each item: icon per type, title, excerpt, timestamp, mark-as-read button, link (uses meta.link)
  - Bulk actions: select → mark read; delete (admin only)
  - Accessible: keyboard navigable, aria-live for new items
- Notification dropdown (header/sidebar icon)
  - Shows latest 5 notifications, red badge if unreadCount > 0, link to /notifications
- Toasts
  - Optional toast for critical notifications; respects user settings later

### Message Unread Badge
- Chat nav icon shows red dot when unreadMessageCount > 0
- Navigating to chat marks the thread as read via RPC or update

## Efficient Queries / Performance
- Prefer RPC `get_notifications_summary` to avoid N+1, returning:
  - notifications with actor minimal info
  - unread_count
- Add necessary indexes to speed range and user filters
- Coalesce noisy notifications (comments/messages) via batching/summarization in triggers

## Accessibility
- Sidebar rail: aria-grabbed, keyboard shortcuts for width adjustments
- Focus management in dropdowns/dialogs; escape closes; roles and labels set
- Screen reader friendly notification items with clear action labels

## Tests and QA
- Unit tests for:
  - formatRelativeDate
  - unread counters aggregation
  - useSidebar width clamp and persistence
- Integration tests (lightweight) mocking RPC outputs for useNotifications
- QA checklist:
  - Sidebar resize min/max and persistence across reload
  - Header logo animation (with reduced motion support)
  - Realtime notifications arrive for weekly report/comment/message
  - Unread badge updates without refresh
  - /notifications filters and bulk mark-as-read
  - RLS enforces privacy (only owner can read/mark own notifications)

## Implementation Order
1) DB: add tables, indexes, RLS; implement RPCs and triggers
2) Hooks: useSidebar, useNotifications, useRealtimeCounts; utility formatRelativeDate
3) UI: sidebar resize + persisted width; header logo animation
4) Notifications page, dropdown, badges; wire realtime
5) Tests and QA

## Deliverables
- SQL migrations: notifications, user_ui_settings, message_unreads; policies; RPCs; triggers
- Frontend hooks/components/pages per above
- Tests for helpers; QA checklist embedded in docs/comments for verification