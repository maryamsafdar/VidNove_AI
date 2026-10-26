# VidNova AI — Turn Your Imagination Into Motion

**VidNova AI** is a zero-cost, open-architecture AI video generation and cinematography studio built with **React 19, TypeScript, Vite, Tailwind CSS, Express, and Vercel Serverless Functions**.

## Core Capabilities

1. **Real Open-Weight Text-to-Video & Image-to-Video (Rs. 0 / $0.00)**
   - Primary engine: **`Lightricks/LTX-2.3 22B Distilled`** (`4s, 6s, 8s, 10s` @ 24 FPS: `97, 145, 193, 241` frames) on **Hugging Face ZeroGPU**.
   - Resilient duration-clamped fallbacks so unsupported durations on backup models never break generation:
     - **`Lightricks/ltx-video-distilled`** (`4s, 6s, 8s` @ 24 FPS; `10s` auto-caps to `8.0s` max model limit with clear UI notice).
     - **`Zeroscope-v2`** (`4s, 6s` @ 8 FPS widescreen; `8s/10s` auto-caps to `6.0s` / 48-frame limit with clear UI notice).
     - **`Wan 2.1 14B Fast`** (Image-to-Video fallback, `81 frames @ 24 FPS ≈ 3.38s` with clear UI notice).
     - **`ByteDance/AnimateDiff-Lightning`** (Text-to-Video short-clip fallback, `16 frames @ 10 FPS = 1.6s` with clear UI notice).
   - Verifies binary MP4 container headers (`ftyp`/`moov`/`mdat`) and `mvhd`/`hdlr` track durations, hydrates clips into local browser `Blob` streams for reliable instant playback and 1-click MP4 downloads, and never fakes videos or duplicates/loops frames.

2. **Bilingual Local AI Prompt Assistant (English & Roman Urdu)**
   - Runs 100% offline in the browser with **zero paid LLM APIs**.
   - Translates and enriches basic English or Roman Urdu ideas (e.g., *"barish ke baad pahari par dhund aur shaam"*) with structured camera movement, lighting direction, environment context, mood, and optical film stock details.

3. **Photo Motion — Local Browser Camera Animation (Non-Generative)**
   - Explicitly labeled **Photo Motion** (never misrepresented as generative AI).
   - Animates validated `JPG`, `PNG`, and `WebP` photographs (up to 8 MB) locally into frame-accurate `4s, 6s, 8s, or 10s` (`120, 180, 240, or 300` unique frames @ 30 FPS) H.264 `.mp4` videos using HTML5 Canvas, WebCodecs `VideoEncoder`, and `mp4-muxer` (with `MediaRecorder` fallback)—zero cloud upload and zero GPU queue wait.

4. **Complete Multi-Page Website & SEO**
   - Pages: `/`, `/studio`, `/explore`, `/text-to-video`, `/image-to-video`, `/how-it-works`, `/faq`, `/contact`, `/privacy`, `/terms`.
   - Dynamic `<title>`, meta descriptions, OpenGraph/Twitter cards, canonical URLs, `WebApplication` / `FAQPage` / `HowTo` Schema.org JSON-LD, `robots.txt`, and `sitemap.xml`.

---

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Zero-Token Default & Optional Server-Side `HF_TOKEN`

- **Frontend / Google AI Studio**: Zero tokens or secrets are required. `.env.example` intentionally omits an active `HF_TOKEN` assignment so Google AI Studio never prompts for a secret, and no token is ever included in client-side `VITE_*` code.
- **Vercel / Self-Hosted Server (Optional, $0 Free Account)**: VidNova AI includes `/api/video/*` Vercel Serverless Functions (`api/video/status.ts`, `text-to-video.ts`, `image-to-video.ts`, `download.ts`). Adding an optional free read-only Hugging Face token (`hf_...` from `huggingface.co/settings/tokens`) as `HF_TOKEN` in **Vercel Project Settings → Environment Variables** unlocks authenticated server-side ZeroGPU priority without exposing your token to browsers.

---

## Syncing to GitHub (`maryamsafdar/VidNove_AI`) & Vercel Hobby Deployment

1. **Sync Updates from Google AI Studio to GitHub**:
   - After reviewing the changes in Preview, click the **GitHub** icon (**Sync / Export to GitHub**) in the top toolbar of Google AI Studio.
   - Select your connected repository **`maryamsafdar/VidNove_AI`** and branch **`main`**, enter a commit message, and confirm.
2. **Verify Vercel Deployment (`main`)**:
   - `vercel.json` configures `npm install`, `npm run build`, `dist` output directory, `api/**/*.ts` serverless functions (`maxDuration: 60`), and clean SPA rewrites that preserve `/api/*`.
   - Optional (recommended for reliable ZeroGPU quota on shared networks): In Vercel → **Settings** → **Environment Variables**, add `HF_TOKEN` = `hf_...` (free Hugging Face Read token, server-side only) and redeploy the latest `main` commit.
