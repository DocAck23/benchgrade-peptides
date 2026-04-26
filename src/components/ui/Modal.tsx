"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * Module-level modal stack.
 *
 * Tracks open dialogs so we correctly manage body scroll lock (unlock only
 * when the last modal closes) and Escape handling (only the topmost modal
 * responds).
 */
const modalStack: { id: string; blocking: boolean; close?: () => void }[] = [];
let savedBodyOverflow: string | null = null;

function pushModal(id: string, blocking: boolean, close?: () => void) {
  if (modalStack.length === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  modalStack.push({ id, blocking, close });
}

function popModal(id: string) {
  const idx = modalStack.findIndex((m) => m.id === id);
  if (idx >= 0) modalStack.splice(idx, 1);
  if (modalStack.length === 0 && savedBodyOverflow !== null) {
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = null;
  }
}

function isTopmost(id: string): boolean {
  return modalStack[modalStack.length - 1]?.id === id;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog with full focus trap, scroll lock, Escape handling, and focus
 * return. `blocking` mode disables backdrop click and Escape — used for the
 * RUO gate where the user must make an explicit choice.
 */
export function Modal({ open, onClose, blocking = false, title, description, children, size = "md", className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const modalId = useId();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    // Stack bookkeeping + body scroll lock
    pushModal(modalId, blocking, onClose);
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    // Focus the first focusable element inside the dialog
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    function handleKey(e: KeyboardEvent) {
      if (!isTopmost(modalId)) return;
      if (e.key === "Escape" && !blocking && onClose) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        // Focus-trap loop
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusables || focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !dialogRef.current?.contains(active)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (active === last || !dialogRef.current?.contains(active)) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      popModal(modalId);
      // Return focus to whatever opened us
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, blocking, onClose, modalId]);

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
        ref={dialogRef}
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
