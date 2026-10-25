import { useEffect } from 'react';
import type { RoutePath } from '../types/studio';

interface RouteMeta {
  title: string;
  description: string;
}

const ROUTE_METADATA: Record<RoutePath, RouteMeta> = {
  '/': {
    title: 'VidNova AI — Turn Your Imagination Into Motion',
    description:
      'Transform text prompts and still photography into motion with VidNova AI. Open-weight ZeroGPU AI video generation, bilingual prompt assistant, and Photo Motion.',
  },
  '/studio': {
    title: 'AI Studio — Create Text & Image Videos | VidNova AI',
    description:
      'Open the VidNova AI Studio to generate Text-to-Video and Image-to-Video clips on ZeroGPU, refine cinematography prompts, or animate stills locally.',
  },
  '/explore': {
    title: 'Explore Creative Cinema Concepts | VidNova AI',
    description:
      'Browse editorial cinematography concepts across landscapes, brutalist architecture, botanical macro, commercial stills, anime cinema, and portraits.',
  },
  '/text-to-video': {
    title: 'Text to Video — Open-Weight Cinema Synthesis | VidNova AI',
    description:
      'Describe a scene in English or Roman Urdu and generate motion clips with Lightricks LTX-Video Distilled and our structured cinematography prompt builder.',
  },
  '/image-to-video': {
    title: 'Image to Video & Photo Motion | VidNova AI',
    description:
      'Animate JPG, PNG, and WebP images using generative ZeroGPU Image-to-Video or instant zero-upload browser Photo Motion camera presets.',
  },
  '/how-it-works': {
    title: 'How VidNova AI Works — Zero-Cost Open Video Pipeline',
    description:
      'Learn how VidNova AI combines local browser cinematography direction, Hugging Face ZeroGPU open-weight DiT synthesis, and client-side Photo Motion.',
  },
  '/faq': {
    title: 'Frequently Asked Questions | VidNova AI',
    description:
      'Transparent answers about VidNova AI zero-cost operation, Hugging Face ZeroGPU quotas, open-source LTX-Video licensing, Roman Urdu prompts, and privacy.',
  },
  '/contact': {
    title: 'Contact & Studio Feedback | VidNova AI',
    description:
      'Reach the VidNova AI engineering and creative direction team with studio feedback, open-source provider inquiries, or collaboration notes.',
  },
  '/privacy': {
    title: 'Privacy Policy & Upload Transparency | VidNova AI',
    description:
      'Read how VidNova AI protects user privacy, validates image uploads without permanent storage, and handles external ZeroGPU inference transparently.',
  },
  '/terms': {
    title: 'Terms of Service & Responsible AI Policy | VidNova AI',
    description:
      'Review VidNova AI terms of use, third-party portrait permission rules, open-weight model usage guidelines, and zero-billing guarantees.',
  },
};

interface SEOHeadProps {
  currentRoute: RoutePath;
  structuredData?: Record<string, unknown> | null;
}

export function SEOHead({ currentRoute, structuredData = null }: SEOHeadProps) {
  useEffect(() => {
    const meta = ROUTE_METADATA[currentRoute] || ROUTE_METADATA['/'];
    document.title = meta.title;

    const setMetaTag = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const canonicalUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${currentRoute === '/' ? '/' : currentRoute}`
        : `https://ais-pre-ke3c2x7dya2shrkvronlmy-117365868003.asia-southeast1.run.app${currentRoute}`;

    setMetaTag('meta[name="description"]', 'name', 'description', meta.description);
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', meta.title);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', meta.description);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);

    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    const existingPageJsonLd = document.getElementById('vidnova-route-jsonld');
    if (existingPageJsonLd) {
      existingPageJsonLd.remove();
    }

    if (structuredData) {
      const script = document.createElement('script');
      script.id = 'vidnova-route-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [currentRoute, structuredData]);

  return null;
}
