/**
 * Bench Grade Peptides — affiliate independent-contractor agreement, v1.
 *
 * Plainly written. The version string is part of the e-signature ledger
 * row, so any future revision MUST bump the version (date-suffixed) and
 * every previously-signed row stays valid evidence of the prior text.
 */

export const AGREEMENT_VERSION = "1099-v1-2026-04-27";

export const AGREEMENT_HTML = `
<article class="bgp-agreement">
  <header>
    <h1>Affiliate Independent Contractor Agreement</h1>
    <p class="version">Version ${AGREEMENT_VERSION}</p>
  </header>

  <p>This Affiliate Independent Contractor Agreement (the &ldquo;Agreement&rdquo;)
  is entered into between Bench Grade Peptides (the &ldquo;Company&rdquo;) and
  the individual identified by the typed signature below (the &ldquo;Affiliate&rdquo;).
  By signing, the Affiliate accepts each of the terms below.</p>

  <h2>1. Services</h2>
  <p>The Affiliate agrees to refer potential customers to the Company&rsquo;s
  research-use-only (RUO) peptide catalogue using a personal referral link
  issued by the Company. The Affiliate may publish honest, factual content
  describing the Company&rsquo;s catalogue and may share the referral link
  through their own properties (websites, newsletters, social channels).
  The Affiliate is solely responsible for the legality and accuracy of any
  content they publish.</p>

  <h2>2. Independent Contractor Status</h2>
  <p>The Affiliate is engaged as an independent contractor, not as an
  employee, agent, partner, or joint venturer of the Company. The Affiliate
  controls the means and methods of their own work, sets their own hours,
  uses their own equipment, and bears their own business expenses. Nothing
  in this Agreement creates an employer-employee relationship. The
  Affiliate is responsible for all of their own federal, state, and local
  taxes, including self-employment tax. The Company will issue an IRS
  Form 1099-NEC for any calendar year in which payments to the Affiliate
  meet or exceed the applicable IRS reporting threshold.</p>

  <h2>3. Compensation</h2>
  <p>The Company will pay the Affiliate commission on qualifying funded
  orders attributable to the Affiliate&rsquo;s referral link, at the
  commission rates and tier thresholds published in the Affiliate&rsquo;s
  dashboard at <code>/account/affiliate</code>. Commission rates and tier
  thresholds may be revised by the Company on at least thirty (30) days&rsquo;
  written notice; revisions are not retroactive to commission already
  earned. Commission becomes earned only when the underlying order is
  funded and the thirty-day refund window has elapsed; commission on
  refunded orders is clawed back. Payouts are issued monthly when the
  Affiliate&rsquo;s available balance reaches the published payout floor.
  The Affiliate may alternatively redeem available commission as Company
  product credit at the redemption ratio published in the dashboard.</p>

  <h2>4. Marketing and Compliance</h2>
  <p>The Affiliate will not (a) make any medical, therapeutic, or
  performance claim about the Company&rsquo;s products, (b) market the
  Company&rsquo;s products to any audience the Affiliate has reason to
  believe will use them in or on humans or animals, (c) imply any
  endorsement of human or veterinary use, or (d) violate the FTC&rsquo;s
  endorsement guides, including the obligation to clearly and
  conspicuously disclose the affiliate relationship. The Company may
  terminate this Agreement immediately for any breach of this section.</p>

  <h2>5. Intellectual Property</h2>
  <p>The Company grants the Affiliate a limited, revocable, non-exclusive,
  non-transferable license to use the Company&rsquo;s name, logo, and
  product imagery solely for the purpose of promoting the Company&rsquo;s
  catalogue under this Agreement. All such marks remain the exclusive
  property of the Company. The Affiliate will not register, attempt to
  register, or use any domain name, social handle, or trademark that is
  confusingly similar to any Company mark. Any goodwill arising from the
  Affiliate&rsquo;s use of Company marks inures to the Company.</p>

  <h2>6. Confidentiality</h2>
  <p>The Affiliate may receive non-public information from the Company,
  including commission structures, customer counts, internal pricing,
  unpublished SKUs, and operational data. The Affiliate will hold all
  such information in confidence, will use it only to perform under this
  Agreement, and will not disclose it to any third party. This obligation
  survives termination for three (3) years.</p>

  <h2>7. Term and Termination</h2>
  <p>This Agreement begins on the date of signing and continues until
  terminated. Either party may terminate at any time, with or without
  cause, on seven (7) days&rsquo; written notice (email is sufficient).
  The Company may terminate immediately for breach of Section 4
  (Marketing and Compliance) or Section 6 (Confidentiality).
  On termination, the Affiliate&rsquo;s referral link is deactivated;
  commission already earned and not yet paid out at the date of
  termination remains payable on the next regular payout cycle, subject
  to the published payout floor.</p>

  <h2>8. Indemnification</h2>
  <p>The Affiliate will defend, indemnify, and hold the Company harmless
  from any third-party claim arising from (a) content the Affiliate
  publishes about the Company or its products, (b) the Affiliate&rsquo;s
  breach of Section 4, or (c) the Affiliate&rsquo;s violation of any
  applicable law in connection with this Agreement.</p>

  <h2>9. No Employment Relationship</h2>
  <p>Nothing in this Agreement entitles the Affiliate to any employee
  benefit of the Company, including health insurance, retirement,
  workers&rsquo; compensation, unemployment insurance, paid leave, or
  equity. The Affiliate is not authorized to bind the Company to any
  contract or obligation, to hold themselves out as an employee or agent,
  or to incur any expense on the Company&rsquo;s behalf.</p>

  <h2>10. Governing Law</h2>
  <p>This Agreement is governed by the laws of the State of Delaware,
  without regard to its conflict-of-laws principles. The exclusive venue
  for any dispute arising from this Agreement is the state and federal
  courts located in Delaware, and each party consents to the personal
  jurisdiction of those courts.</p>

  <h2>11. Entire Agreement</h2>
  <p>This Agreement is the entire agreement between the parties regarding
  the Affiliate&rsquo;s referral relationship with the Company and
  supersedes all prior discussions and writings on that subject. Any
  amendment must be in writing and signed by both parties; an updated
  version of this Agreement, accepted by the Affiliate through the
  Company&rsquo;s dashboard, is sufficient.</p>

  <p class="signature-block">By typing my full legal name below and
  clicking &ldquo;Sign,&rdquo; I acknowledge that I have read, understood,
  and agreed to this Agreement, and that my typed name has the same legal
  effect as a handwritten signature under the federal E-SIGN Act and
  applicable state e-signature law.</p>
</article>
`.trim();
