"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight scroll-reveal hook for the onboarding landing page.
 *
 * Returns a ref to attach to any element and a boolean that flips to `true`
 * the first time that element crosses into the viewport. Deliberately tiny
 * and dependency-free (no framer-motion) — pairs with the `.reveal` /
 * `.reveal-visible` CSS classes in globals.css, which also respect
 * `prefers-reduced-motion`.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If IntersectionObserver isn't available (very old browsers / SSR edge
    // cases), just show the content immediately rather than hiding it forever.
    // Deferred via rAF so we don't call setState synchronously in the effect body.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
          break;
        }
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, visible };
}
