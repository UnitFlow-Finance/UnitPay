"use client";

import { useReveal } from "@/lib/useReveal";

/**
 * Wraps children in a scroll-triggered fade/rise. `delay` (ms) staggers
 * multiple `Reveal`s in the same section for a cascading effect.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}) {
  const { ref, visible } = useReveal();

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement & HTMLLIElement>}
      className={`reveal ${visible ? "reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
