import { InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary placeholder:text-subtle ${className}`}
      {...props}
    />
  );
});

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary placeholder:text-subtle resize-none ${className}`}
      {...props}
    />
  );
});

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
