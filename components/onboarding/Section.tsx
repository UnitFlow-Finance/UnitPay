/**
 * Consistent full-bleed section wrapper for the onboarding landing page:
 * max-width content column, responsive vertical rhythm, optional id for
 * in-page scroll anchors (used by the header nav + hero's secondary CTA).
 */
export function Section({
  id,
  children,
  className = "",
  containerClassName = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <section id={id} className={`relative px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className={`max-w-6xl mx-auto ${containerClassName}`}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent mb-3">
      {children}
    </p>
  );
}
