import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark shadow-sm shadow-primary/20",
  secondary:
    "bg-surface border border-border text-foreground hover:border-primary/40 hover:bg-surface-elevated",
  ghost: "text-muted hover:text-foreground hover:bg-surface",
};

const sizes: Record<Size, string> = {
  md: "text-sm py-2.5 px-4",
  lg: "text-sm sm:text-base py-3 px-5",
};

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

type ButtonProps = ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth = false, className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
});

interface LinkButtonProps extends ButtonOwnProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

/** Same visual treatment as `Button`, but renders a Next.js `Link`. */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}
