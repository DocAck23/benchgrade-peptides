import Link from "next/link";

/**
 * CardProcessorFootnote — single-line italic note rendered beneath the
 * payment-method selector at checkout. Pure presentational, no props.
 *
 * Wave 2d wires this into CheckoutPageClient alongside the cart-UI work.
 */
export function CardProcessorFootnote() {
  return (
    <p className="text-xs italic text-ink-muted leading-relaxed">
      Card processing coming soon &mdash; every order strengthens our case
      for premium merchant approval.{" "}
      <Link
        href="/why-no-cards"
        className="text-gold-dark hover:text-gold underline-offset-2 hover:underline not-italic"
      >
        Read our note &rarr;
      </Link>
    </p>
  );
}

export default CardProcessorFootnote;
