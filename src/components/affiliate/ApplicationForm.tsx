"use client";

import { useState } from "react";
import { applyForAffiliate } from "@/app/actions/affiliate";
import { cn } from "@/lib/utils";

/**
 * ApplicationForm — public application form for /affiliate/apply (Wave B2
 * §C-AFFAPP-1).
 *
 * Fields: name (required), email (required), audience description (textarea
 * 100-2000 chars), website/social (optional). Client-side validation mirrors
 * the Zod constraints on the server action so users get fast feedback.
 *
 * On success: replaces the form with a confirmation card.
 */

const AUDIENCE_MIN = 100;
const AUDIENCE_MAX = 2000;

const primaryBtn =
  "inline-flex items-center justify-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

const inputCls =
  "w-full h-11 px-3 border rule bg-paper text-ink focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold transition-colors duration-200 ease-out disabled:opacity-60";

const textareaCls =
  "w-full px-3 py-2 border rule bg-paper text-ink min-h-[160px] focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold transition-colors duration-200 ease-out disabled:opacity-60";

export function ApplicationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = "Enter a valid email address.";
    const len = audience.trim().length;
    if (len < AUDIENCE_MIN)
      e.audience = `At least ${AUDIENCE_MIN} characters (you have ${len}).`;
    else if (len > AUDIENCE_MAX)
      e.audience = `At most ${AUDIENCE_MAX} characters (you have ${len}).`;
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError(null);
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setPending(true);
    const res = await applyForAffiliate({
      applicant_name: name.trim(),
      applicant_email: email.trim(),
      audience_description: audience.trim(),
      website_or_social: website.trim() || null,
    });
    setPending(false);
    if (!res.ok) {
      setServerError(
        res.error ?? "Couldn't submit application — try again in a moment."
      );
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div
        className="border rule bg-paper-soft p-6 space-y-3"
        role="status"
        data-testid="application-success"
      >
        <h2 className="font-display uppercase text-[14px] tracking-[0.14em] text-gold-dark">
          Application received
        </h2>
        <p className="font-editorial text-base text-ink">
          Thank you. We&apos;ll review within 5 business days and email you at{" "}
          <span className="font-mono">{email}</span>.
        </p>
      </div>
    );
  }

  const audienceLen = audience.trim().length;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
      data-testid="application-form"
      noValidate
    >
      <Field
        id="aff-name"
        label="Your name"
        error={errors.name}
        required
      >
        <input
          id="aff-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          className={inputCls}
          aria-invalid={!!errors.name}
        />
      </Field>

      <Field
        id="aff-email"
        label="Email"
        error={errors.email}
        required
      >
        <input
          id="aff-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className={inputCls}
          aria-invalid={!!errors.email}
        />
      </Field>

      <Field
        id="aff-audience"
        label="Tell us about your audience"
        hint={`${audienceLen} / ${AUDIENCE_MAX} characters · min ${AUDIENCE_MIN}`}
        error={errors.audience}
        required
      >
        <textarea
          id="aff-audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          disabled={pending}
          maxLength={AUDIENCE_MAX}
          className={textareaCls}
          aria-invalid={!!errors.audience}
          placeholder="Who do you reach? What do they care about? Where do you publish?"
        />
      </Field>

      <Field
        id="aff-web"
        label="Website or social profile"
        hint="Optional"
      >
        <input
          id="aff-web"
          type="text"
          autoComplete="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          disabled={pending}
          className={inputCls}
          placeholder="https://…"
        />
      </Field>

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "Submitting…" : "Submit application"}
      </button>

      {serverError && (
        <p
          role="alert"
          className="text-sm text-wine-deep border rule bg-paper-soft p-3"
        >
          {serverError}
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs text-ink-soft uppercase tracking-[0.08em]"
      >
        {label}
        {required && <span className="text-wine-deep ml-1">*</span>}
      </label>
      {children}
      <div className="flex items-center justify-between gap-3 min-h-[1rem]">
        {error ? (
          <p
            role="alert"
            className={cn("text-xs text-wine-deep")}
            id={`${id}-error`}
          >
            {error}
          </p>
        ) : (
          <span />
        )}
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}

export default ApplicationForm;
