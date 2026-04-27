import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DataRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "ACH instructions — adding Bench Grade Peptides as a recipient",
  description:
    "Step-by-step instructions for paying a Bench Grade Peptides order via ACH credit from your bank's bill-pay or external-transfer flow.",
};

const beneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
const beneficiaryAddress =
  process.env.WIRE_BENEFICIARY_ADDRESS ?? "[Beneficiary address — pending]";
const bank = process.env.WIRE_BANK ?? "[Bank name — pending]";
const routing = process.env.WIRE_ROUTING ?? "[Routing — pending]";
const account = process.env.WIRE_ACCOUNT ?? "[Account — pending]";

export default function AchPaymentsPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
      <div className="label-eyebrow text-ink-muted mb-4">Payments · ACH credit</div>
      <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-6">
        Pay your order by ACH.
      </h1>
      <p className="text-base lg:text-lg text-ink-soft leading-relaxed mb-10 max-w-prose">
        ACH is a free, customer-initiated bank transfer. You add Bench Grade Peptides as a
        recipient inside your bank, push the order total, and we ship within 1&ndash;2 business
        days of the deposit landing. No processor in the middle, no card data on our servers.
      </p>

      <section aria-label="Recipient details" className="mb-10">
        <h2 className="font-display text-2xl text-ink mb-4">Recipient details</h2>
        <dl className="bg-paper-soft border rule px-5 py-1">
          <DataRow label="Recipient name" value={beneficiary} />
          <DataRow label="Recipient address" value={beneficiaryAddress} />
          <DataRow label="Bank" value={bank} />
          <DataRow label="Routing (ABA)" value={routing} mono />
          <DataRow label="Account number" value={account} mono />
          <DataRow label="Account type" value="Checking" />
        </dl>
        <p className="mt-3 text-sm text-ink-muted italic leading-relaxed">
          Always include your order memo (e.g. <span className="font-mono-data">BGP-1A2B3C4D</span>)
          in the memo / note field so we can match the deposit to your order. The memo is in your
          confirmation email.
        </p>
      </section>

      <section aria-label="Step by step" className="mb-10">
        <h2 className="font-display text-2xl text-ink mb-4">Step-by-step</h2>
        <ol className="space-y-5 list-decimal pl-6 text-base text-ink leading-relaxed">
          <li>
            <strong>Open your bank&rsquo;s online or mobile app</strong> and find the
            &ldquo;Pay&rdquo;, &ldquo;Transfer&rdquo;, or &ldquo;Bill pay&rdquo; section. The exact
            label varies by bank: Chase calls it &ldquo;Pay &amp; transfer&rdquo;; Bank of America
            calls it &ldquo;Transfers / Bill pay&rdquo;; Wells Fargo splits it into &ldquo;Send &amp;
            transfer&rdquo;.
          </li>
          <li>
            <strong>Choose &ldquo;Send to an external account&rdquo;</strong> (sometimes called
            &ldquo;ACH transfer to another bank&rdquo;, &ldquo;Add a payee&rdquo;, or &ldquo;Pay a
            company&rdquo;). If your bank only shows internal transfers, look under
            &ldquo;Bill pay&rdquo; instead.
          </li>
          <li>
            <strong>Add Bench Grade Peptides as a new recipient</strong> using the details in the
            box above. Use the recipient name exactly as written, select <em>Checking</em> as the
            account type, and double-check the routing and account numbers character-by-character.
          </li>
          <li>
            <strong>Verify the recipient.</strong> Most banks send a small test deposit (a few
            cents) within 1&ndash;2 business days, then ask you to confirm the amount. You only
            need to do this once &mdash; future ACH transfers go straight through.
          </li>
          <li>
            <strong>Send the payment.</strong> Choose &ldquo;Standard ACH&rdquo; (free) rather
            than &ldquo;Same-day ACH&rdquo; (usually a small fee). Enter the order total exactly as
            shown in your confirmation email, and paste your order memo into the memo / note
            field.
          </li>
          <li>
            <strong>Reply to your order confirmation</strong> once the transfer is queued so we
            know to watch for it. We mark the order paid the moment the deposit lands and
            immediately email you a receipt and tracking once it ships.
          </li>
        </ol>
      </section>

      <Callout variant="info" title="How long does this take?">
        Standard ACH typically clears in 1&ndash;3 business days from the moment you confirm the
        send. Same-day ACH (if your bank offers it) clears within hours but usually carries a
        small per-transaction fee that your bank charges you. We don&rsquo;t see either fee &mdash;
        we receive the full order total either way.
      </Callout>

      <Callout variant="warn" title="ACH reversibility &mdash; what to know">
        Customer-initiated ACH transfers can be reversed by you (the sender) for up to 60 calendar
        days under the consumer-protection rules of NACHA, the network that governs ACH. If your
        order has already shipped and you initiate a reversal, we will dispute the chargeback and,
        in cases where the dispute fails, we&rsquo;ll send a final invoice for the shipped product.
        Practically: only use ACH if you intend to keep the order.
      </Callout>

      <section aria-label="Trouble" className="mt-10">
        <h2 className="font-display text-2xl text-ink mb-4">Troubleshooting</h2>
        <div className="space-y-4 text-base text-ink-soft leading-relaxed">
          <p>
            <strong className="text-ink">My bank doesn&rsquo;t offer ACH transfers to outside
            accounts.</strong>{" "}
            Most US banks do, but some smaller credit unions only allow Zelle. If that&rsquo;s your
            situation, switch the order to Zelle or wire by replying to the confirmation email and
            we&rsquo;ll resend instructions.
          </p>
          <p>
            <strong className="text-ink">My bank is asking for a SWIFT code or international
            wire fields.</strong>{" "}
            You&rsquo;re in the wrong flow &mdash; that&rsquo;s an international wire form. Back
            out and look for &ldquo;Domestic ACH&rdquo;, &ldquo;Bill pay&rdquo;, or
            &ldquo;Transfer to another US bank&rdquo;.
          </p>
          <p>
            <strong className="text-ink">I sent the transfer but forgot the memo.</strong>{" "}
            Reply to the order confirmation email with the date, amount, and the last 4 digits of
            your account so we can match the deposit manually. We&rsquo;ll mark it paid the moment
            it lands.
          </p>
        </div>
      </section>

      <div className="mt-12 pt-6 border-t rule text-sm text-ink-muted">
        Questions? Reply to your order confirmation, or email{" "}
        <a href="mailto:admin@benchgradepeptides.com" className="text-gold-dark underline">
          admin@benchgradepeptides.com
        </a>
        . See also our{" "}
        <Link href="/why-no-cards" className="text-gold-dark underline">
          note on why we don&rsquo;t accept cards yet
        </Link>
        .
      </div>
    </article>
  );
}
