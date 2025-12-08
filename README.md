# Getting to Know Kanji — Store (Final)

This repository contains a single-file frontend and a Node.js/Express backend to sell the eBook *Getting to Know Kanji with Vocabulary*.

## What's included
- `public/index.html` — Landing page + buy modal (Tailwind CDN)
- `public/images/` — sample images (included if available)
- `public/sample/Vocabulary With Kanjis-sample.pdf` — your uploaded sample PDF
- `server.js` — Express server with Stripe checkout, contact form, sample download, webhook handler and SQLite order recording
- Dockerfile & docker-compose.yml
- GitHub Actions workflow to build & push Docker image to GitHub Container Registry (GHCR)
- `.env.example` — environment variables

## Local development
1. Copy `.env.example` → `.env` and fill in real values (Stripe keys, SMTP).
2. Install deps: `npm install`
3. Start server: `npm start`
4. Open `http://localhost:3000`

## Testing Stripe (recommended)
- Use Stripe test keys in `.env` (`STRIPE_SECRET_KEY`) and publishable key in `public/index.html` (replace `pk_test_...`).
- Use card number `4242 4242 4242 4242` for successful test charges.
- To test webhooks locally use `stripe listen --forward-to localhost:3000/webhook` (requires Stripe CLI).

## Deploying
- You can deploy with Docker (see `Dockerfile`) or push the repository to GitHub and enable the GitHub Actions workflow to build an image and push to GHCR.
- Platforms: Render, Railway, Heroku, Vercel (serverless), etc.

## Notes
- The sample PDF included is the file you uploaded. If you want a different file name or location, change `public/sample/` accordingly.
- The project records completed sessions (from the webhook) into a lightweight SQLite database at `data/orders.db`.
