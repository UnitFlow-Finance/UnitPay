import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Consistent, responsive header used across all `/wallet/*`, `/merchant`,
 * and `/pay/*` screens: a back link (optional) + title, with a right-hand
 * slot for page-specific actions (e.g. "Refresh", "New request").
 */
export function PageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="shrink-0 -ml-1.5 flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
        )}
        <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
