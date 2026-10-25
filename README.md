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

## Deploying to GitHub (`vidnova-ai`) & Vercel Free Hobby Plan

1. **Export to GitHub**:
   - Click **Export to GitHub** in the Google AI Studio toolbar and create the new repository **`vidnova-ai`** (this creates a fresh repository and leaves `maryamsafdar/qrnova` untouched).
2. **Deploy to Vercel (Rs. 0 Hobby Tier)**:
   - Import the `vidnova-ai` GitHub repository at [vercel.com/new](https://vercel.com/new) on the free **Hobby** plan.
   - `vercel.json` automatically configures `npm run build`, serves `dist/`, and rewrites all SPA routes cleanly. The client-side Studio service automatically connects directly to official Hugging Face ZeroGPU CORS endpoints when deployed statically on Vercel.
