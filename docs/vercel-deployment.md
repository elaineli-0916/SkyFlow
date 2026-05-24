# Vercel Deployment

SkyFlow can run on Vercel as a Vite static frontend plus Vercel serverless API functions.

## What To Set Up

1. Create a Vercel account at `https://vercel.com/`.
2. Connect Vercel to GitHub.
3. Import the `SkyFlow` repository.
4. Keep the default Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Add the production environment variables in Vercel Project Settings:

```bash
DASHSCOPE_API_KEY=your_dashscope_key
QWEN_MODEL=qwen3.5-omni-plus
DASHSCOPE_ASR_MODEL=paraformer-v2
```

Do not add `VITE_` to secret keys. Variables with a `VITE_` prefix are bundled into the browser client by Vite and must never contain provider secrets.

## API Key Safety

The browser never calls DashScope directly. It calls SkyFlow API routes such as:

- `/api/earth/chat`
- `/api/asr/transcribe`
- `/api/moon/timeanddate`
- `/api/health`

Those API routes run on Vercel's server side and read `process.env.DASHSCOPE_API_KEY`. The key is not sent to the browser bundle.

Local `.env.local` is only for local development. Copy the values into Vercel Environment Variables for cloud deployment, but do not commit `.env.local`.

## Local Development

For the existing local workflow, keep using:

```bash
npm run server
npm run dev
```

Vite proxies `/api` to the local Node server in development.

For Vercel-style local testing, install/use the Vercel CLI and run:

```bash
vercel dev
```

The CLI can load local environment variables and run the `api/` functions closer to the deployed shape.
