import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, help, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helpId = help ? `${inputId}-help` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label-eyebrow text-ink-soft">
            {label}
            {props.required && <span className="text-oxblood ml-1" aria-label="required">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-11 px-3 bg-paper border rule text-ink placeholder:text-ink-faint",
            "focus:outline-none focus:border-teal",
            "disabled:bg-paper-soft disabled:text-ink-faint disabled:cursor-not-allowed",
            error && "border-oxblood focus:border-oxblood",
            className
          )}
          {...props}
        />
        {help && !error && (
          <p id={helpId} className="text-xs text-ink-muted">{help}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-oxblood" role="alert">{error}</p>
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
          <label htmlFor={inputId} className="label-eyebrow text-ink-soft">
            {label}
            {props.required && <span className="text-oxblood ml-1" aria-label="required">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "px-3 py-2.5 bg-paper border rule text-ink placeholder:text-ink-faint resize-y",
            "focus:outline-none focus:border-teal",
            "disabled:bg-paper-soft disabled:text-ink-faint disabled:cursor-not-allowed",
            error && "border-oxblood focus:border-oxblood",
            className
          )}
          {...props}
        />
        {help && !error && (
          <p id={helpId} className="text-xs text-ink-muted">{help}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-oxblood" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
