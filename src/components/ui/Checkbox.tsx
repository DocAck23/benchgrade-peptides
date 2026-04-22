"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: string;
  help?: ReactNode;
}

/**
 * Checkbox with inline label and error state.
 *
 * Used for the RUO certification checkbox at checkout — required prop styles
 * the label with a critical-state asterisk.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, help, id, required, checked, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helpId = help ? `${inputId}-help` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 cursor-pointer group" htmlFor={inputId}>
          <span className="relative inline-flex items-center justify-center shrink-0 mt-[3px]">
            <input
              ref={ref}
              id={inputId}
              type="checkbox"
              required={required}
              checked={checked}
              aria-invalid={!!error}
              aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
              className={cn(
                "appearance-none w-[18px] h-[18px] border rule bg-paper cursor-pointer",
                "checked:bg-ink checked:border-ink",
                "group-hover:border-rule-strong",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                error && "border-oxblood",
                "transition-colors",
                className
              )}
              {...props}
            />
            {checked && (
              <Check
                strokeWidth={3}
                className="pointer-events-none absolute w-[12px] h-[12px] text-paper"
              />
            )}
          </span>
          <span className="text-sm text-ink-soft leading-relaxed">
            {label}
            {required && <span className="text-oxblood ml-1" aria-label="required">*</span>}
          </span>
        </label>
        {help && !error && (
          <p id={helpId} className="text-xs text-ink-muted ml-[30px]">{help}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-oxblood ml-[30px]" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";
