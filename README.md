# JAF Chatra Server

Node.js + Express backend API for JAF Chatra, including tenant management, payments, settings, and live chat realtime services.

## Tech Stack

- Node.js (ES modules)
- Express
- MongoDB + Mongoose
- Socket.IO + WebSocket support
- Nodemailer
- Cloudinary file uploads

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB connection string

## Install

```bash
npm install
```

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in required values.

Minimum local example:

```env
NODE_ENV=LOCAL
PORT=8000
API_VERSION=v1

# Required by current constants loader
MONGO_MASTER_DB_URI=mongodb://127.0.0.1:27017

# Also keep suffixed values for compatibility with environment-aware helpers
MONGO_MASTER_DB_URI_LOCAL=mongodb://127.0.0.1:27017
MONGO_MASTER_DB_URI_PROD=YOUR_PROD_MONGO_URI_HERE

JWT_SECRET=replace_with_a_secure_secret
JWT_EXPIRES_IN=7d
```

### Common optional variables

Depending on enabled features, you may also need:

- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- HitPay: `HITPAY_API_BASE_URL`, plus relevant API keys/secrets used by your environment
- Startup seeding: `STARTUP_SEED_COMPANY_NAME`, `STARTUP_SEED_COMPANY_CODE`, `STARTUP_SEED_ADMIN_FULL_NAME`, `STARTUP_SEED_ADMIN_EMAIL`, `STARTUP_SEED_ADMIN_PASSWORD`, `STARTUP_SEED_ADMIN_ROLE`

## Scripts

- `npm run server` - Start API server with nodemon
- `npm run seed` - Run seed script (`seeders/seedDatabase.js`)
- `npm test` - Placeholder test command (not implemented)

## Run Locally

```bash
# from /server
npm install
npm run server
```

Default URL: `http://localhost:8000`

Health route:

```http
GET /api/v1
```

## API Route Groups

Base prefix: `/api/:version`

- `/subscriptions`
- `/subscription-plans`
- `/payments`
- `/agents`
- `/quick-messages`
- `/tenants`
- `/webhook`
- `/faqs`
- `/quick-replies`
- `/chat-settings`
- `/widget-settings`
- `/company-info`
- Live chat routes under:
  - `/api/:version` (tenant live chat routes)
  - `/api/:version/widget/live-chat` (widget live chat routes)

## Realtime

Realtime live chat is initialized through the HTTP server in `services/liveChatRealtime.js`.

## Troubleshooting

- `MongoDB URI is not set` on startup:
  - Ensure `MONGO_MASTER_DB_URI` is present in `.env`.
- Requests fail due to version mismatch:
  - Check `API_VERSION` in `.env` and client API URL values.
- Email sending fails:
  - Verify SMTP settings and credentials.
- Upload issues:
  - Confirm Cloudinary environment variables are set.

## Related Workspace Command

From repository root, run client and server together:

```bash
npm run dev
```
 
