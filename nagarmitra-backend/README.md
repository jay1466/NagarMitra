# NagarMitra Backend (JavaScript)

Express + MongoDB API for the NagarMitra MVP.

## Quick Start

1. Install dependencies
```bash
npm install
```

2. Copy environment and edit
```bash
cp .env.example .env
```

3. Set `MONGODB_URI` and optional `CORS_ORIGIN`

4. Run in dev
```bash
npm run dev
```

5. Health check
- `GET http://localhost:4000/` → basic hello
- `GET http://localhost:4000/api/v1/health` → `{ status: "ok" }`

## Scripts
- `npm run dev` – start with nodemon
- `npm start` – start production server

## Next
- Add models (`src/models/`), controllers, and routes per PRD
- Implement JWT auth and S3 presigned uploads
