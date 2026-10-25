/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { SEOHead } from './components/SEOHead';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';
import { ExplorePage } from './pages/ExplorePage';
import { TextToVideoPage } from './pages/TextToVideoPage';
import { ImageToVideoPage } from './pages/ImageToVideoPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { FaqPage } from './pages/FaqPage';
import { ContactPage } from './pages/ContactPage';
import { PrivacyPolicyPage, TermsOfServicePage } from './pages/LegalPages';
import { FAQ_ITEMS } from './data/showcaseData';
import type { CreationMode, RoutePath, StudioLaunchPayload } from './types/studio';

const VALID_ROUTES = new Set<RoutePath>([
  '/',
  '/explore',
  '/studio',
  '/text-to-video',
  '/image-to-video',
  '/how-it-works',
  '/faq',
  '/contact',
  '/privacy',
  '/terms',
]);

function resolvePathname(pathname: string): RoutePath {
  const clean = (pathname.replace(/\/+$/, '') || '/') as RoutePath;
  return VALID_ROUTES.has(clean) ? clean : '/';
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<RoutePath>(() =>
    typeof window !== 'undefined' ? resolvePathname(window.location.pathname) : '/'
  );
  const [studioPayload, setStudioPayload] = useState<StudioLaunchPayload | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') as CreationMode | null;
    const promptParam = params.get('prompt');
    if (modeParam || promptParam) {
      return {
        mode:
          modeParam === 'text-to-video' ||
          modeParam === 'image-to-video' ||
          modeParam === 'photo-motion'
            ? modeParam
            : undefined,
        prompt: promptParam || undefined,
      };
    }
    return null;
  });

  useEffect(() => {
    const onPopState = () => {
      setCurrentRoute(resolvePathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = useCallback(
    (route: RoutePath, payload?: StudioLaunchPayload) => {
      if (payload) {
        setStudioPayload(payload);
      }
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== route) {
          window.history.pushState({}, '', route);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setCurrentRoute(route);
    },
    []
  );

  const clearStudioPayload = useCallback(() => {
    setStudioPayload(null);
  }, []);

  const routeStructuredData = useMemo<Record<string, unknown> | null>(() => {
    if (currentRoute === '/faq') {
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      };
    }
    if (currentRoute === '/how-it-works') {
      return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to Create AI Motion Videos with VidNova AI',
        step: [
          {
            '@type': 'HowToStep',
            name: 'Imagine',
            text: 'Write a scene prompt in English or Roman Urdu, or upload a validated JPG, PNG, or WebP still image.',
          },
          {
            '@type': 'HowToStep',
            name: 'Create',
            text: 'Select aspect ratio and visual style, then generate via Hugging Face ZeroGPU (LTX-Video) or render local browser Photo Motion.',
          },
          {
            '@type': 'HowToStep',
            name: 'Share',
            text: 'Preview your completed video inside the Cinema Monitor and download the MP4 file.',
          },
        ],
      };
    }
    return null;
  }, [currentRoute]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0D12] text-[#F5F3EC]">
      <SEOHead currentRoute={currentRoute} structuredData={routeStructuredData} />
      <Navbar currentRoute={currentRoute} onNavigate={handleNavigate} />

      <main id="main-content" className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentRoute}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentRoute === '/' && <HomePage onNavigate={handleNavigate} />}
            {currentRoute === '/studio' && (
              <StudioPage
                launchPayload={studioPayload}
                onClearPayload={clearStudioPayload}
                onNavigate={handleNavigate}
              />
            )}
            {currentRoute === '/explore' && <ExplorePage onNavigate={handleNavigate} />}
            {currentRoute === '/text-to-video' && (
              <TextToVideoPage onNavigate={handleNavigate} />
            )}
            {currentRoute === '/image-to-video' && (
              <ImageToVideoPage onNavigate={handleNavigate} />
            )}
            {currentRoute === '/how-it-works' && (
              <HowItWorksPage onNavigate={handleNavigate} />
            )}
            {currentRoute === '/faq' && <FaqPage onNavigate={handleNavigate} />}
            {currentRoute === '/contact' && <ContactPage />}
            {currentRoute === '/privacy' && <PrivacyPolicyPage />}
            {currentRoute === '/terms' && <TermsOfServicePage />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
