## Objectives
- Fix BlogFeed runtime error: "Cannot access 'fetchPosts' before initialization"
- Improve Dashboard header: remove tagline and align logo properly
- Remove "New Announcement" button from announcements page
- Add a single "New Announcement" button in Admin page header that posts to announcements and reflects across the app via realtime
- Verify routing to community via `/dashboard?tab=community`

## Changes
1. BlogFeed.tsx
- Move `fetchPosts` and `fetchLikedPosts` (useCallback) definitions above useEffects to avoid TDZ errors
- Ensure initial load useEffect calls `fetchPosts(0, searchTerm)` and `fetchLikedPosts` after the callbacks are defined
- Keep debounced search effect dependent on `fetchPosts`

2. Dashboard.tsx
- Remove the "Built for college communities" tagline
- Ensure header shows logo aligned with app title; avoid duplication (sidebar already shows logo)
- Keep query param mapping for `?tab=community` and `?tab=blog`

3. Announcements.tsx
- Remove local compose dialog/button; page becomes read-only feed

4. Admin.tsx
- Add global "New Announcement" dialog button in the Admin header
- Fields: Title, Content, optional image, Pin toggle
- Insert into `public.announcements`; relies on existing realtime to update feed instantly

## Verification
- Build and run; navigate to `/dashboard?tab=community` and confirm feed loads without errors
- Open Admin, post an announcement; confirm it appears on Announcements page immediately
- Smoke test sidebar navigation on mobile/desktop; check logo alignment in header

## Notes
- No data schema changes required; announcements table and realtime are already present
- All changes are client-side and safe to apply