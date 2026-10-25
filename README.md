# VidNova AI — Turn Your Imagination Into Motion

**VidNova AI** is a zero-cost, open-architecture AI video generation and cinematography studio built with **React 19, TypeScript, Vite, Tailwind CSS, and Express**.

## Core Capabilities

1. **Real Open-Weight Text-to-Video & Image-to-Video (Rs. 0 / $0.00)**
   - Connects to the official **`Lightricks/ltx-video-distilled`** Diffusion Transformer (DiT) pipeline running on **Hugging Face ZeroGPU**.
   - Supports `16:9`, `9:16`, `1:1`, and `4:3` frame geometries, 6 optical cinematography styles, seed control, native `<video>` preview, and 1-click MP4 downloads.
   - **Strict Honesty**: Never displays fake progress bars or pre-recorded clips. If shared free Hugging Face ZeroGPU capacity is temporarily exhausted, the Studio displays an explicit status notice and links transparently to the official Hugging Face Space.

2. **Bilingual Local AI Prompt Assistant (English & Roman Urdu)**
   - Runs 100% offline in the browser with **zero paid LLM APIs**.
   - Translates and enriches basic English or Roman Urdu ideas (e.g., *"barish ke baad pahari par dhund aur shaam"*) with structured camera movement, lighting direction, environment context, mood, and optical film stock details.

3. **Photo Motion — Local Browser Camera Animation (Non-Generative)**
   - Explicitly labeled **Photo Motion** (never misrepresented as generative AI).
   - Animates validated `JPG`, `PNG`, and `WebP` photographs (up to 8 MB) locally at 30 FPS using HTML5 Canvas and `MediaRecorder` with zero cloud upload and zero GPU queue wait.

4. **Complete Multi-Page Website & SEO**
   - Pages: `/`, `/studio`, `/explore`, `/text-to-video`, `/image-to-video`, `/how-it-works`, `/faq`, `/contact`, `/privacy`, `/terms`.
   - Dynamic `<title>`, meta descriptions, OpenGraph/Twitter cards, canonical URLs, `WebApplication` / `FAQPage` / `HowTo` Schema.org JSON-LD, `robots.txt`, and `sitemap.xml`.

---

## Color System & Typography

- **Midnight Graphite**: `#0B0D12` (Primary neutral canvas)
- **Deep Obsidian**: `#151820` (Elevated studio panels & surfaces)
- **Electric Acid Lime**: `#D5FF3F` (High-contrast primary actions & active states)
- **Sunset Coral**: `#FF6B65` (Editorial highlights & alert accents)
- **Soft Ivory**: `#F5F3EC` (Primary typography)
- **Muted Steel**: `#9298A6` (Secondary body copy & unboxed metadata)
- **Typography**: `Bricolage Grotesque` (Display) + `Plus Jakarta Sans` (Body) + `JetBrains Mono` (Tabular metrics)

---

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Zero-Token Default Operation

No API keys or tokens are required to run the website, homepage, Prompt Assistant, Image Upload, or Photo Motion studio. `.env.example` intentionally omits `HF_TOKEN` so Google AI Studio never prompts for a secret. If deploying your own Node/Express server, you may optionally set a free read-only `hf_...` token in your private server environment (`HF_TOKEN`) for higher ZeroGPU queue priority—never in client-side code.

---

## Syncing to GitHub (`maryamsafdar/VidNove_AI`) & Vercel Hobby Deployment

1. **Sync Updates from Google AI Studio to GitHub**:
   - Click the **GitHub** icon (**Sync / Export to GitHub**) in the top toolbar of Google AI Studio.
   - Select your connected repository **`maryamsafdar/VidNove_AI`** and branch **`main`**, enter a commit message, and confirm to push all updated files (`package.json`, `package-lock.json`, `vercel.json`, `server.ts`, and `src/*`).
2. **Verify Vercel Builds the Latest Commit (`main`)**:
   - Pushing a new commit to `maryamsafdar/VidNove_AI` (`main`) automatically triggers a fresh Vercel production deployment.
   - In the Vercel Dashboard (**Deployments** tab), always open the **newest** deployment at the top of the list rather than clicking **Redeploy** on an older failed deployment (such as `c6663d5`), because redeploying an old card rebuilds that historical commit snapshot.
   - `vercel.json` configures `npm install`, `npm run build`, output directory `dist`, and clean SPA route rewrites on the free Hobby plan.

