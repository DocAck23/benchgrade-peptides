import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Bench Grade Peptides account.",
  robots: { index: false, follow: false },
};

const ERROR_COPY: Record<string, string> = {
  "missing-code": "That sign-in link was incomplete. Please request a new one.",
  "invalid-link": "That sign-in link has expired or already been used. Please request a new one.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const errorCode = sp.error;
  const errorMessage = errorCode ? ERROR_COPY[errorCode] ?? null : null;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : null;

  return (
    <main className="min-h-[calc(100vh-12rem)] bg-paper-soft flex items-start justify-center px-6 lg:px-10 py-20 lg:py-28">
      <article className="w-full max-w-md bg-paper border border-rule rounded-sm p-8 lg:p-10">
        <div className="label-eyebrow text-ink-muted mb-4">Account</div>
        <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-3">
          Sign in to your account.
        </h1>
        <p className="text-sm text-ink-soft leading-relaxed mb-8">
          Sign in with a one-time magic link or your password — both work for the same
          account. Set a password under Account → Security once you&rsquo;re in.
        </p>
        <LoginForm initialError={errorMessage} next={next} />
      </article>
    </main>
  );
}
