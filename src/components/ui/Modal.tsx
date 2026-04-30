"use client";

import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOverlay } from "@/components/ui/Overlay";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  /** When true, the modal cannot be dismissed via backdrop click or Escape. Used for the RUO gate. */
  blocking?: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Visual width cap. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
} as const;

/**
 * Modal dialog with full focus trap, scroll lock, Escape handling, and focus
 * return. `blocking` mode disables backdrop click and Escape — used for the
 * RUO gate where the user must make an explicit choice.
 *
 * Foundation commit 8 of 22: migrated from a bespoke pushModal/popModal
 * stack onto the shared `useOverlay` primitive (Codex Review #1 fix H1).
 * Behavior is preserved (ref-counted scroll lock, topmost-only Escape,
 * focus trap, focus restore); the duplicated infrastructure is gone.
 */
export function Modal({ open, onClose, blocking = false, title, description, children, size = "md", className }: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const { containerRef } = useOverlay<HTMLDivElement>(open, {
    closeOnEscape: !blocking,
    onClose,
    restoreFocus: true,
    lockScroll: true,
    trapFocus: true,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
    >
      {/* Backdrop — wine overlay (spec §16.1) */}
      <div
        className="absolute inset-0 bg-wine/70 backdrop-blur-[2px]"
        onClick={blocking ? undefined : onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        ref={containerRef}
        className={cn(
          "relative w-full bg-paper border border-gold-dark rounded-md shadow-none",
          "max-h-[calc(100vh-2rem)] overflow-y-auto",
          SIZE_CLASSES[size],
          className
        )}
      >
        {!blocking && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-ink-muted hover:text-gold-dark transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}
        <div className="p-8 lg:p-10">
          {title && (
            <h2 id={titleId} className="font-display text-3xl text-ink mb-3 pr-8 leading-tight">
              {title}
            </h2>
          )}
          {description && (
            <p id={descId} className="text-sm text-ink-soft leading-relaxed mb-6">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
