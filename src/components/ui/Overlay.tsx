"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared overlay primitive — the substrate for every modal, drawer, and
 * full-screen sheet on the site.
 *
 * Codex Review #1 fix H1 + H2:
 *   v1 had bespoke focus-trap + scroll-lock implementations in `Modal.tsx`
 *   and `CartDrawer.tsx`. Adding a third in the new mobile nav drawer would
 *   guarantee inconsistent Escape, focus restore, and stacked-overlay bugs.
 *   Foundation extracts the contract here; CartDrawer + Modal migrate to
 *   consume it (commit 8); the new mobile drawer uses it directly (commit 11).
 *
 * Contract:
 *   - **Ref-counted scroll lock.** Module-level counter; lock applied 0→1,
 *     released 1→0. Multiple overlays can stack without prematurely
 *     unlocking body scroll. Beats `body.style.overflow = "hidden"` on iOS
 *     Safari.
 *   - **Focus trap + restore.** Captures `document.activeElement` on open,
 *     traps Tab cycling within the container, restores focus on close.
 *   - **Escape handling.** Optional. Blocking modals (RUO gate) should
 *     swallow Escape to force an explicit choice — pass `closeOnEscape: false`.
 *     Only the topmost overlay responds to Escape.
 *   - **Reduced-motion friendly.** This hook does not animate; consumers
 *     should respect `prefers-reduced-motion: reduce` themselves.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ─── Module-level overlay stack (ref-counted scroll lock + topmost detection) ─

interface StackEntry {
  id: string;
  closeOnEscape: boolean;
  onClose?: () => void;
  lockScroll: boolean;
}

const overlayStack: StackEntry[] = [];
let savedBodyOverflow: string | null = null;

function pushOverlay(entry: StackEntry): void {
  if (entry.lockScroll && lockingCount() === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  overlayStack.push(entry);
}

function popOverlay(id: string): void {
  const idx = overlayStack.findIndex((entry) => entry.id === id);
  if (idx >= 0) overlayStack.splice(idx, 1);
  if (lockingCount() === 0 && savedBodyOverflow !== null) {
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = null;
  }
}

function lockingCount(): number {
  return overlayStack.filter((e) => e.lockScroll).length;
}

function isTopmost(id: string): boolean {
  return overlayStack[overlayStack.length - 1]?.id === id;
}

// ─── Public hook API ─────────────────────────────────────────────────────────

export interface UseOverlayOptions {
  /** Close on Escape key. Default true. Set false for RUO-gate-style blocking modals. */
  closeOnEscape?: boolean;
  /** Restore focus to the previously-focused element on close. Default true. */
  restoreFocus?: boolean;
  /** Lock body scroll while the overlay is open. Default true. */
  lockScroll?: boolean;
  /** Trap Tab cycling within the overlay container. Default true. */
  trapFocus?: boolean;
  /** Called when Escape is pressed (only fires when `closeOnEscape: true`). */
  onClose?: () => void;
  /** Stable ID for the overlay (used in stack tracking). Defaults to a generated id. */
  id?: string;
}

export interface UseOverlayResult<T extends HTMLElement> {
  /** Attach to the overlay container (e.g. the dialog panel root). */
  containerRef: RefObject<T | null>;
  /** Whether this overlay is the topmost in the stack (for visual / a11y hints). */
  isTopmost: () => boolean;
}

let nextId = 0;

/**
 * Reactively manages overlay lifecycle for the duration of `open === true`.
 *
 * Usage:
 *   const { containerRef } = useOverlay(open, {
 *     closeOnEscape: !blocking,
 *     onClose,
 *     restoreFocus: true,
 *     lockScroll: true,
 *     trapFocus: true,
 *   });
 *
 *   return open ? <div ref={containerRef} role="dialog" aria-modal="true">...</div> : null;
 */
export function useOverlay<T extends HTMLElement = HTMLElement>(
  open: boolean,
  options: UseOverlayOptions = {}
): UseOverlayResult<T> {
  const {
    closeOnEscape = true,
    restoreFocus = true,
    lockScroll = true,
    trapFocus = true,
    onClose,
    id: providedId,
  } = options;

  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const stableIdRef = useRef<string>(providedId ?? `ov-${++nextId}`);

  useEffect(() => {
    if (!open) return;
    const id = stableIdRef.current;

    // Capture trigger for focus restore.
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    // Push onto the stack (ref-counted scroll lock + topmost detection).
    pushOverlay({ id, closeOnEscape, onClose, lockScroll });

    // Focus first focusable element after layout settles.
    const focusFrame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    });

    // Keyboard handling — Escape + Tab trap.
    const onKeyDown = (e: KeyboardEvent) => {
      // Only the topmost overlay responds to Escape.
      if (e.key === "Escape" && closeOnEscape && isTopmost(id)) {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (!trapFocus || e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      popOverlay(id);
      if (restoreFocus) previouslyFocusedRef.current?.focus();
    };
    // closeOnEscape, onClose, lockScroll, trapFocus, restoreFocus are options
    // captured at open-time; consumers controlling them dynamically should
    // toggle `open` to re-bind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return {
    containerRef,
    isTopmost: () => isTopmost(stableIdRef.current),
  };
}
