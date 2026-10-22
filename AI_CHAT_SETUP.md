# AI Assistant setup

The AI Assistant is a chat-only integration. It does not read, create, update, or delete CRM data. Conversation history stays in the current browser page and the latest 20 messages are sent with each request. No OpenAI key is sent to the browser; the API uses `store: false`.

## Local setup

1. Revoke the OpenAI key that was pasted into the original request and create a replacement. Do not put it in a `VITE_` variable, React code, or Git.
2. Copy `server/.env.example` to `server/.env` and set `OPENAI_API_KEY`, `FIREBASE_PROJECT_ID`, and Firebase Admin credentials. `FIREBASE_SERVICE_ACCOUNT_JSON` may contain the service account JSON as a single-line JSON value. Prefer a secure credentials file and `GOOGLE_APPLICATION_CREDENTIALS` when supported; never commit service account credentials.
3. Install backend dependencies with `npm --prefix server install`.
4. Start the API with `npm --prefix server run dev`.
5. Start the existing Vite app with `npm run dev`. Vite proxies `/api` requests to `http://localhost:3001`.
6. Sign in with an existing Firebase account and open **AI Assistant** from the sidebar. Verify that a message receives a response and that signing out prevents access.

The API checks Firebase ID tokens using Firebase Admin. Locally, either provide a service account JSON value or configure Application Default Credentials with access to the same Firebase project. The authenticated account needs no additional CRM permissions because the initial version has no CRM tools.

## Production and cPanel

This repository does not identify your specific cPanel provider or enabled packages. cPanel supports Node.js apps through Application Manager/Phusion Passenger only when the hosting provider installs/enables Passenger and a supported Node.js runtime. Confirm that in your hosting account or with the provider before deploying. If unavailable, host the API on a Node.js-capable service instead.

1. Build the frontend using `npm run build` and deploy the `dist/` contents to the current static hosting location.
2. Deploy the `server/` directory as a separate Node.js application in cPanel Application Manager using Node.js 20 or newer and the `server` directory as the application root. Configure its startup file as `index.js`; use the hosting provider's Passenger-specific startup settings if required.
3. Set server environment variables in cPanel Application Manager, not in the frontend build: `OPENAI_API_KEY` (new rotated key), `OPENAI_MODEL` (optional), `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` (or provider-supported Application Default Credentials), and `ALLOWED_ORIGINS` (the exact HTTPS origin of the CRM, without a trailing slash). Keep private keys out of the repository and public web root.
4. Install dependencies in the backend app root with the Node.js version selected by the host. Configure a dedicated HTTPS API subdomain or reverse proxy for `/api`; do not expose the app over plain HTTP.
5. Set `VITE_AI_API_URL` to the HTTPS API origin before building the frontend if the API is on a separate hostname (for example, `https://api.example.com`). If the API is reverse-proxied on the CRM origin, leave it unset so the frontend uses `/api/ai/chat`.
6. Restart the Node.js application from cPanel and check `https://<api-origin>/api/health`. Test a signed-in chat request, an expired/invalid token, a request over the rate limit, and an origin outside the allowlist.

The API limits each verified Firebase user to 10 requests per minute, accepts up to 20 recent messages (4,000 characters per message), and caps generated output at 1,200 tokens. For multi-instance deployments, use a shared rate-limit store; the built-in memory limiter is per process. Configure OpenAI project budgets and usage alerts as an additional account-level spending control.

## Extending with CRM tools later

Tool calling is intentionally not enabled in this version. Future CRM operations should be added as narrowly scoped Responses API tools, with authorization checked for every invocation and explicit confirmation for any write operation. Do not pass untrusted CRM records directly as instructions.
