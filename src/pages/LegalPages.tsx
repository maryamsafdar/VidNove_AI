export function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
      <div className="space-y-3 pb-8 border-b border-white/[0.08]">
        <p className="text-xs font-semibold text-[#D5FF3F]">
          Legal &amp; User Trust · Last Updated October 2026
        </p>
        <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
          VidNova AI is built on minimal data exposure, zero permanent image retention, and transparent external AI inference disclosure.
        </p>
      </div>

      <div className="space-y-8 text-sm text-[#9298A6] leading-relaxed">
        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            1. Zero Permanent Storage of Prompts and Images
          </h2>
          <p>
            VidNova AI does not operate a user tracking database or permanent cloud storage bucket for your creative prompts, uploaded images, or generated videos. Session history inside AI Studio exists strictly in your local browser memory and is cleared automatically when you close or refresh the browser tab.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            2. Local Browser Processing (Prompt Assistant &amp; Photo Motion)
          </h2>
          <p>
            When you use the <strong className="text-[#F5F3EC]">Local AI Prompt Assistant</strong> or <strong className="text-[#F5F3EC]">Photo Motion</strong> mode, 100% of processing happens locally inside your web browser using JavaScript, HTML5 Canvas, and MediaRecorder. In Photo Motion mode, your uploaded photograph is never transmitted over the network.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            3. External AI Processing Disclosure (Hugging Face ZeroGPU)
          </h2>
          <p>
            When you explicitly initiate generative <strong className="text-[#F5F3EC]">Text-to-Video</strong> or <strong className="text-[#F5F3EC]">AI Image-to-Video</strong>, your prompt (and, in Image-to-Video mode, your validated JPG, PNG, or WebP file up to 8 MB) is transmitted over HTTPS to the official <code className="text-[#F5F3EC]">Lightricks/ltx-video-distilled</code> Space hosted on Hugging Face ZeroGPU infrastructure solely to synthesize your video clip. Temporary Gradio output files on Hugging Face Spaces are ephemeral and governed by Hugging Face’s platform privacy policy.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            4. Photographs of Recognizable Individuals
          </h2>
          <p>
            Do not upload sensitive personal documents, private imagery, or photographs of other people without their explicit permission. AI Studio requires explicit user confirmation before staging any reference image for external ZeroGPU inference.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            5. Zero Paid Billing, Zero Intrusive Advertising
          </h2>
          <p>
            VidNova AI collects no payment card details, runs no third-party ad networks, and sets no cross-site behavioral advertising cookies.
          </p>
        </section>
      </div>
    </div>
  );
}

export function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
      <div className="space-y-3 pb-8 border-b border-white/[0.08]">
        <p className="text-xs font-semibold text-[#FF6B65]">
          Responsible Creative Use · Last Updated October 2026
        </p>
        <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
          Terms of Service
        </h1>
        <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
          By accessing VidNova AI and the AI Studio, you agree to responsible creative practices, model license compliance, and fair community GPU usage.
        </p>
      </div>

      <div className="space-y-8 text-sm text-[#9298A6] leading-relaxed">
        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            1. Free Access &amp; Shared Community Quotas
          </h2>
          <p>
            VidNova AI is provided free of charge (Rs. 0 / $0) on an “as-available” basis. Generative AI synthesis relies on shared community Hugging Face ZeroGPU hardware. You agree not to run automated scraping bots, quota-evasion scripts, or abusive parallel requests against the studio or upstream Hugging Face Spaces.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            2. Consent &amp; Prohibited Content
          </h2>
          <p>
            You represent and warrant that you own the rights—or hold explicit consent from all depicted individuals—for any image uploaded to AI Studio. You may not use VidNova AI to generate non-consensual likenesses, deceptive impersonations, unlawful material, harassment, or content that violates upstream open-weight model safety policies.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            3. Open-Weight Model Licensing
          </h2>
          <p>
            Clips synthesized through Lightricks LTX-Video Distilled are subject to the applicable Lightricks LTX-Video Open Weights License terms. Illustrative concept artwork in the VidNova AI Inspiration Gallery is provided for educational prompt reference and visual inspiration.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            4. Honest Representation of AI Capabilities
          </h2>
          <p>
            VidNova AI makes no guarantee of uninterrupted GPU queue availability. When free community ZeroGPU capacity is saturated, the platform will display an explicit unavailability notice rather than simulated results.
          </p>
        </section>
      </div>
    </div>
  );
}
