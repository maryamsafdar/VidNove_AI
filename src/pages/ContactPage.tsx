import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy, Mail, Send } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Studio Feedback');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) {
      nextErrors.name = 'Please enter your name (at least 2 characters).';
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (message.trim().length < 15) {
      nextErrors.message = 'Please share a bit more detail (at least 15 characters).';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const formatted = [
      `VidNova AI Studio Inquiry`,
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Topic: ${topic}`,
      `---`,
      message.trim(),
    ].join('\n');

    setSubmittedSummary(formatted);
  };

  const handleCopySummary = async () => {
    if (!submittedSummary) return;
    try {
      await navigator.clipboard.writeText(submittedSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure safely
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#FF6B65]">
              Direct Studio Correspondence
            </p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#F5F3EC] tracking-tight">
              Contact VidNova AI
            </h1>
            <p className="text-sm text-[#9298A6] leading-relaxed">
              Have feedback on the AI Studio workflow, open-weight ZeroGPU model suggestions, or Roman Urdu prompt vocabulary additions? Send us a structured note.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-6 space-y-3 text-xs text-[#9298A6] leading-relaxed">
            <p className="font-semibold text-[#F5F3EC] text-sm">
              Zero-CRM Privacy Guarantee
            </p>
            <p>
              To preserve our zero-cost, zero-tracking pledge, VidNova AI does not pipe your contact details into third-party marketing trackers or paid CRM databases. Submitting this form formats a clean inquiry brief you can dispatch directly via your preferred email client or copy for GitHub issue reporting.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          {!submittedSummary ? (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-2xl border border-white/[0.09] bg-[#151820] p-6 sm:p-8 space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-semibold text-[#F5F3EC] mb-2"
                  >
                    Your Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ayesha Khan"
                    aria-invalid={Boolean(errors.name)}
                    className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EC] focus:border-[#D5FF3F]"
                  />
                  {errors.name && (
                    <p className="text-xs text-[#FF6B65] mt-1.5">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-semibold text-[#F5F3EC] mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors.email)}
                    className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EC] focus:border-[#D5FF3F]"
                  />
                  {errors.email && (
                    <p className="text-xs text-[#FF6B65] mt-1.5">{errors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="contact-topic"
                  className="block text-xs font-semibold text-[#F5F3EC] mb-2"
                >
                  Topic
                </label>
                <select
                  id="contact-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EC]"
                >
                  <option value="Studio Feedback">Studio Feedback &amp; UX</option>
                  <option value="Open-Source Video Models">Open-Source Video Models / ZeroGPU</option>
                  <option value="Prompt Assistant Lexicon">English &amp; Roman Urdu Prompt Lexicon</option>
                  <option value="Privacy or Safety Report">Privacy or Content Safety Report</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-xs font-semibold text-[#F5F3EC] mb-2"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your feedback, bug report, or creative feature request..."
                  aria-invalid={Boolean(errors.message)}
                  className="w-full rounded-xl bg-[#0B0D12] border border-white/15 p-3.5 text-sm text-[#F5F3EC] focus:border-[#D5FF3F]"
                />
                {errors.message && (
                  <p className="text-xs text-[#FF6B65] mt-1.5">{errors.message}</p>
                )}
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm font-semibold hover:bg-[#E2FF70] transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Prepare Studio Message</span>
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-[#D5FF3F]/35 bg-[#151820] p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#D5FF3F]">
                  Inquiry Validated &amp; Ready
                </p>
                <h2 className="text-xl font-bold text-[#F5F3EC]">
                  Thank you, {name.trim()}.
                </h2>
                <p className="text-xs sm:text-sm text-[#9298A6]">
                  Your message has been formatted locally without storing personal data on external trackers. Dispatch via your mail app or copy below:
                </p>
              </div>

              <pre className="rounded-xl bg-[#0B0D12] border border-white/10 p-4 text-xs text-[#F5F3EC] font-mono whitespace-pre-wrap">
                {submittedSummary}
              </pre>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    `[VidNova AI] ${topic} — ${name.trim()}`
                  )}&body=${encodeURIComponent(submittedSummary)}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold hover:bg-[#E2FF70] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span>Open in Email Client</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/15 bg-[#0B0D12] text-xs font-medium text-[#F5F3EC] hover:border-white/35 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-[#D5FF3F]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#9298A6]" />
                      <span>Copy Formatted Note</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubmittedSummary(null);
                    setMessage('');
                  }}
                  className="text-xs text-[#9298A6] hover:text-[#F5F3EC] ml-auto cursor-pointer"
                >
                  Write Another Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
