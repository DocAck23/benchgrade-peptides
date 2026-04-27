"use client";

import { useEffect, useState, useTransition } from "react";
import { submitPrelaunchSignup } from "@/app/actions/prelaunch";

const DISMISS_KEY = "bgp_prelaunch_dismissed";
const SHOW_DELAY_MS = 4000;

/**
 * Pre-launch waitlist popup. Lifecycle:
 *
 *  • Server passes `suppressed` based on a UA scan — bots, crawlers,
 *    and headless link-preview fetchers never see the modal.
 *  • Client-side, we additionally suppress when the visitor has
 *    already submitted or dismissed (localStorage flag), and on the
 *    /admin and /checkout flows where popping it would be hostile.
 *  • Shows after a 4-second delay so it doesn't block first paint
 *    perceived performance.
 *
 * Submitting hits `submitPrelaunchSignup`, which writes to
 * `prelaunch_signups`, sends the branded welcome email, and is
 * rate-limited per-IP.
 */
export function PrelaunchPopup({ suppressed }: { suppressed: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suppressed) return;
    if (typeof window === "undefined") return;

    // Don't pop on admin/checkout/account/auth flows.
    const path = window.location.pathname;
    if (
      path.startsWith("/admin") ||
      path.startsWith("/checkout") ||
      path.startsWith("/account") ||
      path.startsWith("/auth") ||
      path.startsWith("/login") ||
      path.startsWith("/api/")
    ) {
      return;
    }

    // ?prelaunch=show forces the popup back open even if the visitor
    // already dismissed it — used for QA, screenshots, or letting an
    // existing visitor see the new tier copy.
    const params = new URLSearchParams(window.location.search);
    const force = params.get("prelaunch") === "show";

    let dismissed = false;
    try {
      if (force) {
        localStorage.removeItem(DISMISS_KEY);
      } else {
        dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      }
    } catch {
      /* private mode */
    }
    if (dismissed) return;

    // Force-show is immediate; normal flow waits for the delay.
    if (force) {
      setOpen(true);
      return;
    }
    const t = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [suppressed]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* swallow */
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter your email to join the list.");
      return;
    }
    start(async () => {
      const res = await submitPrelaunchSignup({ email: email.trim() });
      if (!res.ok) {
        setError(res.error ?? "Could not sign up. Please try again.");
        return;
      }
      setSubmitted(true);
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* swallow */
      }
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-ink/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prelaunch-popup-title"
      onClick={close}
    >
      <div
        className="w-full sm:max-w-md bg-paper border-t-4 sm:border border-wine sm:rule sm:m-6 p-6 sm:p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center text-ink-muted hover:text-ink"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-2">
            <div className="label-eyebrow text-gold-dark mb-3">You're on the list</div>
            <h2 className="font-display text-2xl text-ink leading-tight mb-3">
              Welcome to Bench Grade Peptides.
            </h2>
            <p className="text-sm text-ink-soft leading-relaxed mb-5">
              Your cohort code is on its way — check your inbox in a minute.
              We'll write again the moment the catalogue goes live.
            </p>
            <button
              type="button"
              onClick={close}
              className="h-11 px-6 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="label-eyebrow text-gold-dark mb-3">
              First-250 cohort · launching this week
            </div>
            <h2
              id="prelaunch-popup-title"
              className="font-display text-2xl sm:text-3xl text-ink leading-tight mb-3"
            >
              Be one of the first 250.
            </h2>
            <p className="text-sm text-ink-soft leading-relaxed mb-3">
              Sign up and we'll email you a launch code worth{" "}
              <strong className="text-ink">10% off + free shipping for life</strong>.
            </p>
            <ul className="text-xs text-ink-muted leading-snug mb-5 space-y-1">
              <li>· $250+ orders &mdash; every vial 30% off</li>
              <li>· $500+ orders &mdash; free vial of your choosing</li>
              <li>· Subscribe &amp; prepay 3 mo &mdash; 18% off total</li>
              <li>· Subscribe &amp; prepay 6 mo &mdash; 25% off total</li>
            </ul>

            <form onSubmit={onSubmit} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                placeholder="you@research.lab"
                className="w-full h-11 px-3 border rule bg-paper text-sm focus:outline-none focus:border-ink"
              />
              {error && <div className="text-xs text-danger">{error}</div>}
              <button
                type="submit"
                disabled={pending}
                className="w-full h-11 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors disabled:opacity-60"
              >
                {pending ? "Sending…" : "Get the code"}
              </button>
            </form>

            <p className="text-[11px] text-ink-muted leading-snug mt-4">
              No spam. We'll email when we launch and not before. Reply
              UNSUBSCRIBE at any time.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
