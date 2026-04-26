import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
}

/**
 * Locked brand text input (spec §16.1):
 *   - paper bg, ink text, rule (gold-tinted) border
 *   - gold-light focus ring (2px), gold border on focus
 *   - danger border + danger text on error
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, help, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helpId = help ? `${inputId}-help` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label-eyebrow">
            {label}
            {props.required && (
              <span className="text-[color:var(--color-danger)] ml-1" aria-label="required">*</span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-11 px-3 rounded-sm bg-paper border border-rule text-ink placeholder:text-ink-muted",
            "focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold-light focus:ring-offset-0",
            "disabled:bg-paper-soft disabled:text-ink-muted disabled:cursor-not-allowed",
            "transition-[border-color,box-shadow] duration-200 ease-[var(--ease-default)]",
            error && "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)] focus:ring-[color:var(--color-danger)]/30",
            className
          )}
          {...props}
        />
        {help && !error && (
          <p id={helpId} className="text-xs text-ink-muted">{help}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-[color:var(--color-danger)]" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  help?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, help, id, rows = 4, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helpId = help ? `${inputId}-help` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label-eyebrow">
            {label}
            {props.required && (
              <span className="text-[color:var(--color-danger)] ml-1" aria-label="required">*</span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "px-3 py-2.5 rounded-sm bg-paper border border-rule text-ink placeholder:text-ink-muted resize-y",
            "focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold-light focus:ring-offset-0",
            "disabled:bg-paper-soft disabled:text-ink-muted disabled:cursor-not-allowed",
            "transition-[border-color,box-shadow] duration-200 ease-[var(--ease-default)]",
            error && "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)] focus:ring-[color:var(--color-danger)]/30",
            className
          )}
          {...props}
        />
        {help && !error && (
          <p id={helpId} className="text-xs text-ink-muted">{help}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-[color:var(--color-danger)]" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
