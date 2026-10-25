# Changelog

## v1.2.0 — 2026-10-25

### Added — production complaint workflow (modelled on CPGRAMS / Swachhata / FixMyStreet)
- **India-wide hierarchy**: Super Admin (India) → State Master Admin (36 states/UTs) → District Admin (784 districts) → Department Officers → Citizens.
- **Auto-routing**: each complaint goes to the officer of the matching department (Roads, Sanitation, Water, Electricity, General) in its district, least-loaded first. Other officers cannot see it.
- **Jurisdiction-scoped access**: officers see their department in their district; district/state admins see their area; the super admin sees everything.
- **Deadlines (SLAs)** per category and priority, with an **escalation ladder**: officer reminder → District Admin (+24h) → State Admin (+3 days) → Super Admin (+7 days). Runs every 15 minutes and via `/api/v1/jobs/sla-sweep` for an external cron.
- **Status workflow**: submitted → assigned → acknowledged → in progress → resolved (with proof photo) → closed by the citizen (with rating), or reopened within 7 days; rejecting requires a reason. Resolved complaints auto-close after 7 days.
- Citizens can **remind the officer** (once per 24h).
- **Notifications** for every step (in-app inbox, unread badges, local alerts; push-ready via Expo).
- **Complaint detail** screen with photos, map, officer, deadline, timeline and role-specific actions.
- **Officer Work Queue** and **Admin panel** (totals, overdue, escalated, unassigned, breakdown by state/district/department, officer performance).
- **Manage people**: admins create accounts and assign roles strictly below their own, within their jurisdiction.
- **State → District dropdowns** everywhere (bundled list of 36 states/UTs and 784 districts), auto-filled from GPS when possible.
- Demo seeder (`npm run seed:demo`, password from `DEMO_PASSWORD` in `.env`).

### Fixed
- Empty GeoJSON `coordinates` default broke user upserts.
- Any unhandled promise rejection used to shut the whole API down.
- Any logged-in user could search all users by email (with unescaped regex).

## v1.1.0 — 2026-10-25

### Fixed
- **Dashboard crashed on open** in the APK: Google Maps needed an API key. Replaced with an OpenStreetMap (Leaflet) map that needs no key.
- **New users could not be saved** (`Can't extract geo keys`): models defaulted `location.type` to `Point` without coordinates. Profile, notifications and community posts all failed because of this.
- **Community posts / stories could not be added** (same root cause), and posts from the API rendered blank because the app expected a different shape.
- **Login screen**: typed text was invisible in Android dark mode, the keyboard covered the password field, and errors showed raw Firebase codes.
- **"Stay logged in" off** could sign the user out immediately after logging in.
- **Profile Save always failed** (`updateProfile` was never exported) and nothing was saved to the server.
- Rate limiting counted every user as one IP behind Render's proxy.
- AI photo detection never worked (hand-set multipart header without a boundary).
- Photos were silently discarded by a mock upload; they are now compressed and stored with the report/post.
- Unhandled errors around GPS, camera, gallery and network calls.

### Changed
- Removed fake data: random "mock" complaints on the heatmap, sample community posts/stories, fake notifications, hard-coded home statistics.
- Removed the fake phone/OTP login (it accepted `123456` without creating an account) and the voice note (it was never stored).
- Feedback is now actually submitted (`POST /api/v1/feedback`).
- "My reports" uses the verified login instead of a `uid` query parameter anyone could change.
- Server errors no longer leak internal messages; validation errors return 400 with a readable message.
- Every screen has its own crash guard with a "Try again" button.
- Version and release date come from one place (`src/appInfo.js`); release date updated from "September 2024".
