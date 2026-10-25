# Changelog

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
