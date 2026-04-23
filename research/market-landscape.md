# Bench Grade Peptides LLC — Market Landscape & GTM Report

*Prepared: 2026-04-22. Audience: founder. Scope: US-facing RUO (research-use-only) synthetic peptide e-commerce for 2026 launch.*

> **Honesty convention used throughout.** Specific numbers, dates, and direct quotes are linked to a source. Where a price, MOQ, or ownership fact could not be verified without scraping the live site, the body says "**not verifiable without scraping**" rather than inventing. Where a claim is inferred (rather than reported), it is prefixed "**inference:**". Where the underlying market is in active flux (GLP-1 enforcement, Peptide Sciences shutdown aftermath), the report timestamps the fact.

---

## Top 10 Action Items for the Founder, Prioritized

1. **Do not sell GLP-1 analogs (semaglutide, tirzepatide, retatrutide, cagrilintide, mazdutide, survodutide) at launch.** Every single FDA warning letter in the December 2024 and September 2025 waves, the CBP 5,000-shipment seizure, and the Eli Lilly / Novo Nordisk civil suits target this exact class. Coded names ("GLP-1 R") are explicitly called out by FDA as a ruse. Launch with the 50 non-GLP-1 SKUs, treat the 6 coded GLP-1 SKUs as a post-launch decision after 90 days of watching enforcement. See §3.
2. **Publish Janoshik third-party COAs with QR-linked lot lookup for every SKU on day one.** This is the single biggest trust gap competitors leave open, and it is cheap to execute. See §6.
3. **Use real scientific names on product pages, not bro/obfuscated names.** "BPC-157 (Body Protection Compound 157), 5 mg, >98% HPLC" reads like a reagent catalog. Competitors are split — Sigma/Cayman-style naming is a blue-ocean wedge in this category. See §6.
4. **Run wire/ACH only, stated transparently, with an explicit reason.** Do not try to backdoor a card processor. The "high-risk merchant account" path ends in chargebacks, account freezes, and a data trail FDA uses as evidence of human-consumption intent. See §1 and §3.
5. **Write the compliance framework into the product copy, not just the footer.** Every product page must carry "Not for human consumption. Not for veterinary use. In-vitro research reagent." above the fold. The FDA warning letters explicitly cite RUO disclaimers buried in footers as insufficient. See §3.
6. **Do not publish dosing guides, protocols, injection guides, or "benefits" copy.** Every warning letter cites those as proof of human-use intent. Instead: mechanism-of-action pages with peer-reviewed citations, MW/formula tables, HPLC references, solubility data. Sigma/Tocris have built 40-year businesses on reagent-catalog voice. See §4 and §6.
7. **Pick a US-synthesis secondary supplier now, even at higher unit cost.** Cincinnati CBP intercepted 5,000 Chinese peptide shipments Dec 2025–Mar 2026; AgeREcode-style single-source-from-China exposes you to a single seizure killing 90 days of inventory. Bachem, CPC Scientific, GenScript, and LifeTein all manufacture research peptides domestically — lead time and MOQ not verifiable without direct quote but all publish RFQ forms. See §2.
8. **Own the "lab-grade reagent catalog" aesthetic wedge.** Competitor landscape today is either (a) gym-bro aesthetic (Amino Asylum, Swiss Chems) or (b) generic medical-stock-photo (Core Peptides, Limitless). A genuine Sigma-Aldrich reagent catalog treatment (CAS numbers, formula weights, storage conditions, solubility, peer-reviewed references per SKU) is empty positioning. See §6.
8. **Write the top 10 SEO pages in the first 60 days.** "BPC-157 research guide," mechanism-of-action landing pages, a peptide reconstitution calculator, and MW/CAS-indexed SKU pages. BPC-157 draws ~165,000 US searches/month per [Peptide Dossier's 2026 State of Peptides data](https://www.peptidedeck.com/blog/bpc-157-vendor-review-2026); keyword difficulty in this niche is low (KD 4–8) per the same dataset. See §4.
9. **Plan for the "Peptide Sciences shutdown is still reallocating traffic" window.** Peptide Sciences (the category's largest gray-market vendor) shut down March 6, 2026 per [multiple reports](https://thepeptidecatalog.com/articles/what-happened-to-peptide-sciences). That traffic is currently being reallocated across Swiss Chems, Pure Rawz, Limitless, and newcomers. A branded, scientific-credibility entrant in mid-2026 arrives into an unusually fragmented market — but also arrives after regulators have demonstrated willingness to act. See §1 and §3.
10. **Keep a "go-dark" playbook written before launch.** Every major vendor that was raided (Amino Asylum June 2025, Paradigm Peptides/Matthew Kawa indictment per [DOJ N.D. Indiana](https://www.justice.gov/usao-ndin/united-states-v-matthew-kawa)) did not have operational continuity plans. At minimum: offshore DNS, counsel on retainer, customer-data minimization (don't store what you don't need), no internal Slack with therapeutic-claim language. See §3 and §7.

---

## 1. Competitor Landscape

The US-facing research peptide vendor landscape in April 2026 is shaped by three forces: (1) the shutdown of Peptide Sciences in March 2026, (2) the FDA/DOJ enforcement wave that removed Amino Asylum, hobbled Swiss Chems, Summit, and Prime Peptides, and (3) rising enforcement on GLP-1 analogs specifically.

### 1.1 Competitor table — verified facts and honest gaps

Sources for this section: a mix of trade reviews (Muscle and Brawn, Outliyr, Peptide Dossier, Peptide Examiner), FDA enforcement records, Trustpilot, and vendor homepages. **Exact current pricing is not verifiable without scraping** — review-site price quotes drift by months. Positioning language and broad ranges are cited where found.

| Vendor | URL | Status (Apr 2026) | Payment stack (reported) | Notes |
|---|---|---|---|---|
| Peptide Sciences | peptidesciences.com | **Shut down March 6, 2026** after FDA pressure, per [Peptide Catalog](https://thepeptidecatalog.com/articles/what-happened-to-peptide-sciences) and [Peptides Explorer](https://peptidesexplorer.com/blog/peptide-sciences-shut-down). Category's largest former gray-market vendor. | Historically accepted cards + crypto. | Template the industry copied: clean science-forward UX, HPLC/MS results per SKU, no claims. Reference case for how far "reagent voice" can scale. |
| Limitless Life Nootropics / Limitless Biotech | [limitlesslifenootropics.com](https://limitlesslifenootropics.com/), limitlesslifepeptides.com | Active. Positions as USA-made. | Not cleanly verifiable — review coverage on [Muscle and Brawn](https://muscleandbrawn.com/peptides/limitless-life-nootropics-review/) does not list a full payment stack. | BPC-157 priced $64.99–$102.99 for various SKUs per [Muscle and Brawn Apr 2026 review](https://muscleandbrawn.com/peptides/limitless-life-nootropics-review/); 5 mg BPC-157 quoted at $49.99 there. Launched oral BPC-157 capsules Nov 2024 ([Yahoo Finance](https://finance.yahoo.com/news/limitless-biotech-introduces-oral-bpc-140000562.html)) — **that crosses into oral/human-use territory** and is the kind of signal FDA cited in the Summit and Prime letters. |
| Swiss Chems | swisschems.is | **Received FDA warning letter Dec 10, 2024** alongside Prime, Summit, and Xcel ([The Hill](https://thehill.com/policy/healthcare/5046379-fda-warns-companies-unapproved-weight-loss-drugs/)). Still operating. | Reported to accept Bitcoin, cards, Zelle per [Sarmguide comparison](https://sarmguide.com/peptide-sciences-vs-swisschems/). | Carries 40+ peptides. Post-warning-letter changes to site not verified. |
| Pure Rawz | purerawz.co | Active. USA-based per [Outliyr](https://outliyr.com/best-online-peptide-companies-websites-sources). | Crypto, Zelle, Venmo (per Outliyr). | Broad catalog (peptides, nootropics, SARMs). Reviewers note prices above market; third-party testing reported but quality of program not externally audited. |
| Core Peptides | [corepeptides.com](https://www.corepeptides.com/) | Active. | Not verifiable without scraping. | Clean science-first UX. "USA made" positioning. Full catalog depth not verified. |
| Amino Asylum | amino-asylum.net | **Raided by federal authorities June 2025** per [Muscle and Brawn](https://muscleandbrawn.com/reviews/amino-asylum-raided-in-2025/). Status unclear; site was down with payment pages removed. | Before raid: Zelle, CashApp, cards via 3rd-party processors. | Forum accusations of product spiking persistent. Cautionary tale, not competitor. |
| Prime Peptides | primepeptides.co | **Received FDA warning letter Dec 10, 2024**. Still operating. Offers a "peptide calculator" tool. | Not cleanly verifiable. | Publishes testing protocols page. |
| Summit Research Peptides | summitresearchpeptides.com | **Received FDA warning letter Dec 10, 2024** ([FDA warning letter](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters) — the 695607 letter specifically cites Semaglutide, Retatrutide, Cagrilintide, Tirzepatide, and Mazdutide for sale and social-media-based therapeutic claims). | Not verifiable. | Direct template for what triggers enforcement. Read the letter. |
| USApeptide.com | usapeptide.com | **Received FDA warning letter** per [Health Law Alliance commentary](https://www.healthlawalliance.com/blog/fda-targets-glp-1-and-peptide-compounding-advertising-and-research-use-only-labeling). | Not verifiable. | Cited specifically for RUO-as-ruse. |
| Element Sarms | [elementsarms.com](https://www.elementsarms.com/) | Active. Since ~2010. | Not verifiable. | Claims 99%+ purity, HPLC/MS per SKU, "5000+ five-star reviews" (self-reported). |
| Kimera Chems | [kimerachems.co](https://kimerachems.co/) | Active. US-made positioning. | Not verifiable. | Broad catalog; limited external review depth. |
| NextChems | [nextchems.com](https://nextchems.com/) | Active. Worldwide shipping. | Not verifiable. | Offers money-back on negative HPLC tests per [Newswire review](https://www.newswire.com/news/nextchems-reviews-2025-best-sarms-peptides-research-chemicals-22637386). |
| Paradigm Peptides (Matthew Kawa) | paradigmpeptides.com | **Under federal investigation / indicted**, Northern District of Indiana — [US v. Matthew Kawa](https://www.justice.gov/usao-ndin/united-states-v-matthew-kawa). Cautionary case. | Historically cards, crypto. | Do not use as model. |

**Vendors the founder asked about where coverage is thin/absent:**

- **Bioperine Peptides, Evolved Chemical, US Research Labs, ProCap Labs, Aspire Research Chemicals, Vendor-City** — no substantive independent coverage surfaced in the research window. Treat as either (a) very small operations, (b) defunct, or (c) seed/ASCII variants. Confirm independently before using as a benchmark.

### 1.2 Pricing benchmarks (verified points only)

Because review sites inherit stale prices and because most vendors obfuscate tirzepatide pricing behind coded-name gates, the cleanest comparable data point is the non-GLP-1 "classic" peptides. The verified data points in this research window:

- **BPC-157 5 mg**: vendor-posted prices range $30–$70; at clinical/medical providers rise to ~$199 with TB-500 5 mg bundled. Limitless Life 5 mg: $49.99 ([Muscle and Brawn](https://muscleandbrawn.com/peptides/limitless-life-nootropics-review/)). Broader range per [SeekPeptides cost guide](https://www.seekpeptides.com/blog/articles/peptide-therapy-cost-complete-guide).
- **CJC-1295 / Ipamorelin 10 mg blend**: $85–$95 vendor, with graduated volume discounts at 3/5/10 units typical; Peptide Sciences listed CJC-1295/Ipamorelin 10 mg blend before shutdown (see [archived product page](https://www.peptidesciences.com/cjc-1295-ipamorelin-10mg-blend)).
- **Semaglutide research vials**: one vendor listed at $90 in the same data point, but **GLP-1 pricing is a moving target post-shortage resolution (Feb/Apr 2025) and post-enforcement wave**. Pricing verification for the founder's own catalog should be done against live competitor data the week of launch.
- **Tirzepatide 10 mg-equivalent research vials**: **not verifiable without scraping**. Most vendors that used to list openly are now gated, delisted, or have received warning letters. Eli Lilly's April 2025 federal lawsuits against telehealth distributors further chilled open listing.

### 1.3 Trust signals seen and missing

- **HPLC/MS per SKU with vendor-issued COA**: widespread (Swiss Chems, Pure Rawz, Element Sarms, Core Peptides, Limitless). This is now table stakes, not a differentiator.
- **Third-party Janoshik COA**: meaningful but not universal. [Prime Peptides publishes testing protocols](https://primepeptides.co/testing/); Janoshik-verified lots are the de facto credibility mark per [QSC verification guide](https://qsc-usa.com/janoshik-verification/). Batch ID is publicly queryable on [janoshik.com](https://janoshik.com/).
- **Live lot-number lookup / QR-on-vial COA**: **rare to absent**. This is the single most under-occupied trust slot.
- **Sample programs / trial packs**: a few vendors run 3x1 mg sample bundles; not uniformly priced and not consistent.
- **Institutional account / PhD verification gate**: absent across the consumer-facing vendors. Bachem, GenScript, and the academic-aligned CDMOs do it, but none of the gray-market consumer vendors require institution verification.

---

## 2. US-Based Supplier Alternatives to AgeREcode

The founder's primary candidate is [AgeREcode](https://agerecode.com) in China (not yet confirmed as supplier per the project's [supplier_and_catalog memory](../docs/supplier_and_catalog.md)). The China-only path has three risks visible in the data: (a) CBP is actively seizing these exact shipments at Cincinnati and probably other ports ([CBP press release](https://www.cbp.gov/newsroom/local-media-release/cincinnati-cbp-foils-scheme-smuggle-over-5000-unapproved-peptides-us)), (b) FDA's Sept 2025 "Green List Import Alert" specifically targets GLP-1 API imports, and (c) Chinese hormone/peptide import volumes to the US are visible in customs data — roughly doubled to $328M in the first three quarters of 2025 per [ChinaTalk analysis](https://www.chinatalk.media/p/chinese-peptides) — which means CBP has every incentive to invest more in interdiction, not less.

Realistic US-based contract-synthesis alternatives — none of which will openly sell GLP-1 API under RUO framing, and all of which are priced at institutional rates, not gray-market rates:

| Lab | URL | Scale / capability (published) | RUO paperwork posture | MOQ / lead time | Likely to ship to single-founder LLC? |
|---|---|---|---|---|---|
| **Bachem** | [bachem.com](https://www.bachem.com/) | Non-GMP peptide synthesis 5 mg to 100 g; GMP available. US + European sites. Large stock catalog. | Reagent-grade, well-documented. Established reputation; will not engage in obvious gray-market resale. | Per [Bachem custom synthesis](https://www.bachem.com/custom-peptide-synthesis-services/) — quote-based. Published lead times not disclosed. | Yes for catalog products; custom synthesis requires business diligence. |
| **AAPPTec** | [peptide.com](https://www.peptide.com/) | Louisville, KY. Custom synthesis mg to kg, crude to 98%. | Conservative reagent posture. | Quote-based. Not verifiable without RFQ. | Likely yes, but will diligence you on intended use. |
| **CPC Scientific** | [cpcscientific.com](https://cpcscientific.com/) | CDMO — research-grade through commercial API. | Pharma-grade. Will require formal KYC. | Quote-based. CMC-oriented. | Likely no for consumer-facing resale; yes for legitimate R&D accounts. |
| **LifeTein** | lifetein.com | Custom synthesis with many modifications; academic-leaning customer base. | Reagent posture. | Quote-based. Known for fast turnaround on small scale. | Likely yes for small LLC with reasonable use case. |
| **GenScript** | [genscript.com](https://www.genscript.com/peptide.html) | 100 mg–2 kg large-scale synthesis; PepPower platform. 10,000+ scientists served. | Reagent posture. Catalog + custom. Published price-match program. | 5-day fastest turnaround per [GenScript peptide large-scale page](https://www.genscript.com/peptide_large_scale.html). MOQ depends on length/purity. Published university contract pricing exists (e.g., [Iowa State contract pricing](https://www.procurement.iastate.edu/sites/default/files/Documents/Genscript%20Contract%20Pricing.pdf)) — useful as a sanity-check benchmark even though they are institutional rates. | Yes for mainstream catalog; will diligence custom-synthesis of restricted sequences. |
| **Biosynthesis Inc / Bio-Synthesis** | biosyn.com | Custom peptide and oligo synthesis. | Reagent posture. | Quote-based; **not verified**. | Likely yes. |
| **AnaSpec / Sigma-Aldrich (MilliporeSigma)** | sigmaaldrich.com, anaspec.com | Catalog + custom. | Pharma-grade. Formal KYC. Institutional customer base. | Catalog items ship freely; custom synthesis requires qualification. | For catalog — yes. For branded-sequence wholesale — no. |
| **Bio-Techne / Tocris / R&D Systems** | [tocris.com](https://www.tocris.com/) | 3,500+ reagents synthesized in-house. | Strictly reagent. Academic customer base. | Catalog. | Yes for catalog research reagents. |

### 2.1 US GLP-1 API under RUO framing — realistic assessment

**No reputable US contract lab will sell semaglutide, tirzepatide, retatrutide, cagrilintide, mazdutide, or survodutide API under RUO framing to a startup LLC in 2026.** The risk vector is too visible. The GLP-1 molecules are under active enforcement (FDA warning letter wave Sept 2025 per [Wilson Sonsini](https://www.wsgr.com/en/insights/fda-sends-warning-letters-to-more-than-50-glp-1-compounders-and-manufacturers.html)), active litigation (Eli Lilly, Novo Nordisk), active criminal referral, and active CBP import interdiction. Any US lab that sold API to a consumer-facing LLC and saw it retailed online would be complicit.

Sources the founder might see framed as exceptions to this:
- 503B outsourcing facilities that compound GLP-1s — **not relevant**; those are pharma distribution channels, not reagent channels, and are also subject to the March 2025 compounding-discretion cutoff per [McDermott](https://www.mwe.com/insights/semaglutide-shortage-resolved/).
- Chinese suppliers that ship API to US repackagers — this is the **freight-forwarder / repackaging middleman category** called out in the founder's prompt. Real category, growing in 2024–2025, but functionally the same risk profile as direct China import with an extra party to be indicted. Not recommended.

**Concrete recommendation for §2:** single-source AgeREcode for non-GLP-1 SKUs at MOQ the founder can absorb, dual-source with a US catalog-peptide supplier (LifeTein or AAPPTec are the most responsive to small LLCs; Bachem for premium-priced SKUs where margin can absorb it). Skip the GLP-1 class until enforcement stabilizes.

---

## 3. Regulatory + Enforcement Environment 2024–2026

### 3.1 Why Bench Grade is not a compounding pharmacy

FD&C Act **Section 503A** governs state-licensed compounding pharmacies compounding for individual patients with a prescription. **Section 503B** governs FDA-registered outsourcing facilities compounding in bulk without patient-specific prescriptions. Bench Grade is **neither** — it is a reagent wholesaler selling non-GMP research chemicals to other entities, not compounding finished drug products for human use. That is the entire legal structure supporting the RUO wedge, and it only holds if the product copy, marketing, and customer behavior all support "reagent, not drug."

The FDA explicitly does not accept "RUO" as a shield when other evidence points the other way. From the [Health Law Alliance analysis of the FDA warning letters](https://www.healthlawalliance.com/blog/fda-targets-glp-1-and-peptide-compounding-advertising-and-research-use-only-labeling): the disclaimer is "considered a ruse by the FDA if any other evidence suggests human consumption." Other evidence includes dosing guides, injection protocols, testimonials, before/after imagery, bundled kits with syringes and bacteriostatic water, Telegram/Discord marketing, oral/capsule product lines, social-media "benefits" claims, and price structures keyed to human-dose increments.

### 3.2 FDA warning-letter timeline (verified)

- **December 10, 2024** — FDA issues warning letters to **Prime Peptides, Summit Research Peptides, Swisschems, and Xcel Peptides** for selling semaglutide, tirzepatide, retatrutide, cagrilintide, and mazdutide as RUO while marketing for human use. [The Hill coverage](https://thehill.com/policy/healthcare/5046379-fda-warns-companies-unapproved-weight-loss-drugs/); [FDA Roundup Dec 17 2024](https://www.fda.gov/news-events/press-announcements/fda-roundup-december-17-2024).
- **June 2025** — Federal raid on Amino Asylum's warehouse; first physical raid on a major peptide vendor per [Muscle and Brawn](https://muscleandbrawn.com/reviews/amino-asylum-raided-in-2025/).
- **April 2025** — Eli Lilly files federal lawsuits against telehealth distributors of compounded tirzepatide.
- **August 2025** — Novo Nordisk sues 14 defendants over compounded semaglutide.
- **September 9, 2025** — FDA issues warning letters to **50+ GLP-1 compounders and manufacturers** per [Wilson Sonsini](https://www.wsgr.com/en/insights/fda-sends-warning-letters-to-more-than-50-glp-1-compounders-and-manufacturers.html). FDA establishes **"Green List" import alert** targeting GLP-1 APIs.
- **December 2025 – March 2026** — CBP Cincinnati intercepts ~5,000 Chinese peptide shipments including retatrutide, semaglutide, tirzepatide, MOTS-C, TB-500, semax, cagrilintide ([CBP release](https://www.cbp.gov/newsroom/local-media-release/cincinnati-cbp-foils-scheme-smuggle-over-5000-unapproved-peptides-us)).
- **March 6, 2026** — Peptide Sciences announces shutdown per [Peptide Catalog](https://thepeptidecatalog.com/articles/what-happened-to-peptide-sciences).
- **Ongoing** — DOJ Operation "Unsafe Peptides" per [Peptide Laws](https://peptidelaws.com/news/recent-doj-actions-against-illegal-peptide-distributors); Matthew Kawa / Paradigm Peptides case in Northern District of Indiana ([DOJ](https://www.justice.gov/usao-ndin/united-states-v-matthew-kawa)). Tailor Made Compounding LLC forfeited $1.79M per the same source.

### 3.3 FTC enforcement

FTC enforcement has centered on **telehealth weight-loss advertising**, not reagent sellers — but the same unfair-and-deceptive-practices framework applies.

- **July 2025** — FTC action against **NextMed**: misleading pricing, fake reviews, deceptive weight-loss claims for GLP-1 programs ([FTC press release](https://www.ftc.gov/news-events/news/press-releases/2025/07/ftc-takes-action-against-telemedicine-firm-nextmed-over-charges-it-used-misleading-prices-fake)).
- **December 3, 2025** — Final order against NextMed; $150,000 judgment for consumer refunds ([FTC final order](https://www.ftc.gov/news-events/news/press-releases/2025/12/ftc-approves-final-order-against-telehealth-provider-nextmed-over-charges-it-used-deceptive)).

**Implication for Bench Grade:** fake reviews, bundled "weight-loss program" pricing, and dark-pattern auto-enrollment are the FTC hot buttons. Bench Grade's ACH/wire-only model already avoids the subscription dark-patterns vector; do not reintroduce it via an "auto-ship" program copied from the supplement industry.

### 3.4 State AG landscape

More than 40 state attorneys general sent a formal multi-state letter to the FDA on GLP-1 counterfeits and research-grade diversion per [Stevens & Lee analysis](https://www.stevenslee.com/health-law-observer-blog/glp-1-weight-loss-drug-enforcement-in-2025-state-attorneys-general-step-into-a-growing-regulatory-gap/). California's Board of Pharmacy and AG's office are the most active enforcement shops. New York's Office of Professional Medical Conduct actively investigates physicians. **As of April 2025, New York prohibits sale of muscle-building or weight-loss products to under-18 consumers** — the age-21 gate already planned is good; make sure the state-level geofence at minimum treats NY like a tier-1 jurisdiction.

Connecticut AG Tong sued GLP-1 distributor Triggered Brand in 2025 ([CT AG release](https://portal.ct.gov/ag/press-releases/2025-press-releases/attorney-general-tong-sues-glp-1-weight-loss-drug-distributor-triggered-brand)). Expect more of this pattern from AGs in CA, NY, TX, MA, and WA.

### 3.5 GLP-1 compounding landscape post-shortage

- **October 2, 2024** — FDA resolves tirzepatide shortage.
- **February 21, 2025** — FDA resolves semaglutide shortage ([FDA compounding policies update](https://www.fda.gov/drugs/drug-alerts-and-statements/fda-clarifies-policies-compounders-national-glp-1-supply-begins-stabilize)).
- **February 18, 2025** — 503A enforcement discretion ends for tirzepatide.
- **April 22, 2025** — 503A enforcement discretion effectively ends for semaglutide.
- **March 19, 2025** — 503B enforcement discretion ends for tirzepatide.
- **May 22, 2025** — 503B enforcement discretion ends for semaglutide.
- **April 24, 2025** — District court denies preliminary injunction in *Outsourcing Facilities Association v. FDA* for compounded semaglutide.

**What changed for research-chem sellers:** pre-2025, the legitimate compounding channel was compressed by shortage but also protected by it. After the shortage resolved, everyone who had been compounding or reselling GLP-1 under shortage-discretion lost that cover at once. That squeezed demand toward gray-market RUO vendors — which is why enforcement pivoted toward those vendors in Sept 2025. **Inference: the next 12–18 months are the highest-enforcement-risk window the research peptide category has ever seen.** Bench Grade's launch timing coincides with peak enforcement scrutiny on exactly the SKUs (GLP-1 analogs) the founder was planning to sell under coded names.

### 3.6 Customs interdiction patterns

CBP Cincinnati's December 2025 operation intercepted approximately **5,000 individual peptide shipments** across 300 master cartons, mis-manifested as unrelated goods, from a single Chinese shipper ([CBP release](https://www.cbp.gov/newsroom/local-media-release/cincinnati-cbp-foils-scheme-smuggle-over-5000-unapproved-peptides-us)). Interdiction is not uniform — Louisville, JFK, LAX, and Chicago ORD are the other major express-consignment inbound ports for this category.

**Realistic seizure rates are unknowable publicly** but inference from visible seizure volumes plus visible import volumes ($328M through Q3 2025 from [ChinaTalk](https://www.chinatalk.media/p/chinese-peptides)) suggests a small percentage of shipments are intercepted — but the intercepted shipments are concentrated in the GLP-1 class, and that concentration is rising. A direct-import model concentrated in GLP-1 SKUs from China is increasingly exposed.

---

## 4. SEO + Keyword Landscape

### 4.1 Top commercial-intent keywords

**Honest disclaimer: specific CPC and difficulty numbers require a paid tool (SEMrush/Ahrefs) with a live account.** The numbers below that are citable come from [Peptide Dossier's 2026 State of Peptides report](https://www.peptidedeck.com/blog/bpc-157-vendor-review-2026), which aggregates DataForSEO. Numbers not explicitly cited are inferred from search behavior and should be validated with a paid tool before the founder commits spend.

Verified data points:
- **BPC-157**: ~165,000 US monthly searches, KD 4–8 (low).
- **TB-500**: ~74,000 US monthly searches.
- **GHK-Cu**: ~90,500 US monthly searches.

Inferred high-value commercial-intent keyword clusters (validate before spending):
1. "BPC-157 buy" / "buy BPC-157"
2. "BPC-157 for sale"
3. "TB-500 buy"
4. "CJC-1295 ipamorelin buy"
5. "peptide calculator" / "peptide reconstitution calculator"
6. "research peptides USA"
7. "peptide COA" / "peptide certificate of analysis"
8. "third party tested peptides"
9. "semaglutide research" (high CPC but enforcement-loaded — avoid bidding even if you sell it)
10. "tirzepatide research" (same)
11. "GHK-Cu buy" / "copper peptide buy"
12. "epitalon buy"
13. "MOTS-c research"
14. "selank for sale"
15. "semax buy"
16. "PT-141 research"
17. "melanotan II buy"
18. "ipamorelin 5mg"
19. "sermorelin research"
20. "LL-37 peptide"

### 4.2 Informational content gaps

These are the content clusters where a science-credibility brand outranks the gym-voice incumbents:
- **Mechanism-of-action pages per compound**, with peer-reviewed citations in AMA/Vancouver format.
- **MW / CAS / formula reference tables**. Sigma/Cayman own this format — none of the gray-market vendors do it cleanly.
- **HPLC method reference pages** (column, gradient, retention time per peptide).
- **Solubility data per peptide** — genuinely useful to researchers, rarely published.
- **Peptide reconstitution calculator** — Prime Peptides runs one ([Prime Peptides calculator](https://primepeptides.co/peptide-calculator/)), Peptide Fox runs one ([Peptide Fox calculator](https://peptidefox.com/tools/calculator)); build a better, no-registration version with shareable links.
- **Glossary pages** (HPLC, acetate salt, TFA, lyophilized, bacteriostatic).
- **CoA reading guide** — most buyers can't interpret the Janoshik output.
- **Storage & handling references** (−20°C lyophilized, 2–8°C reconstituted, freeze/thaw tolerance).
- **Peer-reviewed study summaries per SKU** — BPC-157 alone has 100+ animal studies per [PubMed literature review](https://pubmed.ncbi.nlm.nih.gov/40005999/); nobody has done a clean summary per SKU.

### 4.3 Backlink patterns — acceptable vs. risky

**Acceptable:**
- Glossary/educational content cited on legitimate science and biotech blogs.
- Peer-reviewed citation indexing (schema.org/MedicalScholarlyArticle markup).
- Open publishing of HPLC methods — reagent-catalog behavior that attracts academic inbound links.

**Risky:**
- Forum seeding on r/Peptides, r/bodybuilding — moderators and community aggressively call out vendor-seeded reviews per [Peptide Deck vendor guide](https://www.peptidedeck.com/blog/best-legit-peptide-vendors-2026). Reddit's vendor-mention rules change repeatedly; assume any seeding will eventually be traced.
- MesoRX, ThinkSteroids, AnabolicMinds — these communities tolerate vendor talk but have their own sponsor structures; pay-to-sponsor posts are usually fine, disguised seeding is bannable.
- Paid reviews on outlier review sites — low-authority backlinks, high risk of Google manual action.
- Telegram / Discord direct-to-buyer promotion — useful for gray-market peers, indefensible if FDA or FTC subpoenas the logs. Do not use.

### 4.4 On-page structured data opportunities

Category-wide, competitors are leaving these schema.org types on the table:
- `Product` with `gtin` / `sku` / `mpn` + `brand` + `manufacturer`. Most use `Product` but skip `manufacturer`.
- `ChemicalSubstance` (via schema.org/ChemicalSubstance extension) — MW, formula, IUPAC name, CAS, PubChem ID.
- `MedicalScholarlyArticle` for each peer-reviewed citation linked from a SKU page.
- `QuantitativeValue` in `size` with `unitCode` (MLL for mL, MGM for mg) — Google extracts these for rich snippets per [JSON-LD for SEO guide](https://www.gtechme.com/insights/json-ld-for-seo-structured-data-guide/).
- `FAQPage` schema on each SKU — the SKU page doubles as a FAQ-rich snippet candidate.
- `BreadcrumbList` uniformly across the catalog.

### 4.5 Content cluster architecture

A defensible cluster tree (pillar → hub → spoke):
```
Pillar: "What is a research peptide?" (hub for the category)
 ├─ Hub: "BPC-157" (scientific profile, MW/formula, mechanism, literature)
 │   ├─ BPC-157 peer-reviewed literature summary
 │   ├─ BPC-157 HPLC method reference
 │   ├─ BPC-157 reconstitution reference
 │   ├─ BPC-157 CAS / PubChem ID card
 │   └─ BPC-157 SKU pages (5 mg, 10 mg, kit)
 ├─ Hub: "TB-500" (same subtree)
 ├─ Hub: "CJC-1295 / Ipamorelin"
 ├─ Hub: "GHK-Cu / AHK-Cu / Copper peptides"
 └─ (etc. — 15 hubs at launch, 56 SKUs as spokes)
Tools:
 ├─ /tools/peptide-calculator
 ├─ /tools/coa-lookup
 └─ /tools/hplc-method-reference
```

---

## 5. Pricing Models in the Wild

The research-peptide category has four visible pricing archetypes. The founder's 56-SKU plan maps cleanly to the tiered-volume model.

### 5.1 Flat markup (ex-Peptide Sciences template)

- Single price per SKU, no volume discount.
- Clean, fast UX.
- Limits upside on high-volume buyers.
- **Benchmark:** Peptide Sciences' final-era pricing sat roughly 2–3x over their China wholesale cost by category consensus — **not independently verifiable**. The gross-margin estimate is inference, not confirmed data.

### 5.2 Tiered volume (Limitless / Swiss Chems / many Chinese wholesalers)

- 1 / 5 / 10 / 25 / 100 unit bands with progressively deeper discounts.
- Standard band spread: 5%, 10%, 15%, 20%, 25%.
- Most common structure in the consumer-facing segment.
- Wholesale-adjacent B2B tiers: 50 / 250 unit programs (e.g., [Cenexa Labs wholesale](https://cenexalabs.com/wholesale-program/)) start at 50 units/SKU with 250-total-unit MOQ.

### 5.3 Subscription / auto-ship

- **Virtually absent in RUO peptides.** Makes sense — the FTC NextMed case shows subscription dark-patterns are a magnet for enforcement, and lyophilized peptides genuinely don't support the "I use N mg per month, charge me automatically" pattern that supplement subscriptions rely on. Do not introduce.

### 5.4 Institutional / verified-researcher tier

- Present at the CDMO end (Bachem, GenScript give institutional contract pricing — see [Iowa State Genscript contract](https://www.procurement.iastate.edu/sites/default/files/Documents/Genscript%20Contract%20Pricing.pdf)).
- **Absent at the consumer-facing gray-market end.** Opportunity: gate a "verified lab" tier behind real institutional email verification + PO process. Reserves the best pricing for customers who self-select into the safer buyer pool.

### 5.5 Sample packs / bundles

- 3x1 mg trial kits and "starter pack" formats exist at a few vendors. Not standardized. Useful conversion tool for new-customer acquisition. **Avoid bundles that visibly assemble human-use kits** (bac water + syringes + peptide = stack that FDA will cite, as happened in several warning letters).

### 5.6 Markup benchmarks per SKU band (honest version)

Without a verified wholesale price sheet from AgeREcode, precise markup guidance is impossible. The verified data points allow this much:

- **Classic peptides (BPC-157, TB-500, GHK-Cu, CJC-1295, Ipamorelin, Sermorelin) 5 mg vials**: vendor retail $30–$100. Wholesale cost at quantity from China is generally quoted at $3–$15/vial per public Alibaba/Made-in-China listings — **not independently verified for AgeREcode specifically**. Gross margin potential is real but depends on the specific supplier quote.
- **GLP-1 analogs**: enforcement-loaded, pricing volatile, **do not enter at launch**.
- **Copper peptides, PT-141, Melanotan**: lower unit cost, smaller market. Margin percentage attractive, absolute dollars per SKU modest.

The honest pricing recipe for the founder: price **3 points below the Limitless Life Nootropics median** on the classic SKUs at launch, hold at Swiss Chems / Pure Rawz median on the niche ones, and **skip GLP-1 entirely**. Revisit pricing monthly for the first six months.

---

## 6. Branding + Differentiation

### 6.1 Current category aesthetic split

- **Gym-bro / muscle aesthetic**: Amino Asylum (pre-raid), Swiss Chems, Element Sarms. Bold red/black, kettlebell icons, "lab-tested" badges that visually resemble supplement-industry trust seals.
- **Generic medical-stock-photo**: Core Peptides, Pure Rawz, Kimera Chems, NextChems. Blue gradients, stethoscope/flask stock imagery, "USA made" lockups.
- **Clean science-forward**: Peptide Sciences (shut down) was the closest to this. Limitless Life attempts it inconsistently. Nobody in the gray-market segment is executing the Sigma-Aldrich reagent-catalog aesthetic at depth.

### 6.2 Sigma-Aldrich / Cayman Chemical / Tocris — what to borrow

- **Catalog-card density**. Cayman product pages show Item No., Batch No., CAS Registry No., Molecular Formula, Formula Weight, and Purity in a uniform data block — see the [Cayman Chemical CofA format](https://cdn.caymanchem.com/cdn/iso/19249-0703689-01-CofA.pdf). That pattern transfers directly to a peptide reagent SKU.
- **Storage & handling block per SKU**. Every Sigma product shows storage temperature, physical state, solubility, and hazard pictograms. Transfers directly.
- **References section per SKU**. Tocris lists 2–6 peer-reviewed references per reagent; nobody in the RUO peptide segment does this.
- **Size/pack-size selector**. Sigma lists "1 mg, 5 mg, 10 mg" as a radio-style pack size selector; gray-market vendors typically list as separate products, losing SKU aggregation signal.
- **Typography**: slab-serif for the compound name, sans-serif for data fields. The "scientific authority" signal comes from the typography discipline, not from any single visual element.
- **Whitespace density**. Sigma/Tocris use whitespace aggressively. Gray-market vendors cram the product page with urgency copy, testimonials, trust badges, cross-sells. **Inverse correlation with perceived credibility.**

### 6.3 Whitespace in category messaging — things nobody is saying

- "**We publish the HPLC trace, not a PDF certificate**." Competitors publish the COA PDF. Publishing the raw chromatogram image (even with the vendor's batch ID watermark) is a stronger trust signal and trivially more work.
- "**Every lot is independently verified before it ships**." Post-Janoshik-verified lots, not pre-verified.
- "**QR on every vial points to a lot-specific COA URL**." Live and permanent, not a downloaded PDF.
- "**We do not sell oral, capsule, patch, or nasal-spray products**." Affirmative RUO scope. Limitless crossing into oral BPC-157 capsules is exactly the kind of signal FDA flags.
- "**We do not publish dosing guides, injection protocols, or therapeutic claims**." Affirmative non-claim as a brand position.
- "**All SKUs are indexed by CAS and PubChem ID**." Makes the site link-target-friendly to academic and biotech audiences.

### 6.4 Trust-signal gaps the category leaves open

- **Live lot-number lookup with public URL**. Janoshik publishes a queryable database; vendors rarely surface the direct-link pattern on their own product pages.
- **Immutable lot log**. Timestamp + hash-chain of every lot issued, publicly browsable. Overkill? Maybe. Defensible moat for a credibility brand.
- **Sample-program with pre-opt-in batch testing**. Ship 1 mg free for ordering a separate $50 Janoshik test on the buyer's behalf; results go to the buyer and are also published to the public lot log.
- **Published HPLC method per SKU** — column, gradient, detector, retention time. Almost nobody does this.
- **Third-party batch-spec sheet archive** — persistent URLs that do not break when product listings are delisted.

### 6.5 Naming conventions

- **Scientific / reagent-voice naming** (Sigma, Tocris, Cayman): "BPC-157, TFA salt, lyophilized, >98% HPLC, 5 mg" — precise, non-consumer-facing.
- **Gray-market mixed naming** (most competitors): "BPC-157 5mg" with consumer-facing copy underneath. The name itself is scientific; the surrounding copy is not.
- **Obfuscated naming** (emerging on GLP-1 SKUs after Dec 2024): "GLP-1 R," "Retamorelin," "Tirzapeptide," "Sema-T." **FDA has signaled explicitly that code names are treated as ruse evidence**, not as credible research-reagent naming. Coded naming increases enforcement risk; it does not decrease it.

**Recommendation:** use full scientific naming including salt form and purity grade (Sigma pattern) on the 50 non-GLP-1 SKUs. Do not launch the GLP-1 SKUs at all. If the founder eventually launches them, use the real INN (semaglutide, tirzepatide) rather than a code, and gate the SKUs behind a real institutional-researcher verification; this is paradoxically safer than code names because it drops the "intent to deceive" element.

---

## 7. Go-to-Market Recommendations (90-day plan)

### 7.1 Three positioning options, ranked by differentiation strength

**Option A — "The reagent catalog for peptide research" (strongest)**
- Sigma-Aldrich aesthetic, CAS/PubChem/MW indexing, peer-reviewed references per SKU, HPLC methods published, no dosing copy, no protocols, no benefits claims.
- Attracts academic, biotech, and serious independent researchers.
- Minimizes FDA/FTC enforcement surface.
- Inferred conversion-rate disadvantage vs. gym-voice incumbents on consumer traffic — offset by lower CAC on organic academic/long-tail traffic.
- **Recommended.**

**Option B — "US-made, US-tested, US-shipped"**
- Lean on domestic-synthesis partnerships (LifeTein / AAPPTec) for a subset of flagship SKUs. Janoshik-verified in addition. Clean science-forward design but less catalog-austere than Option A.
- Moderate differentiation; several competitors already claim "USA made."
- Vulnerable to price competition from Chinese-sourced rivals.

**Option C — "Verified researcher network"**
- Gate access behind real institutional verification; publish a researcher directory; offer tiered pricing to verified labs.
- Highest trust signal; also highest friction and narrowest TAM.
- Probably too narrow as a standalone launch strategy; works better layered on Option A (gate the deepest discount tier, not the front door).

### 7.2 Top 10 SEO content pieces, in order

1. **"BPC-157 — Mechanism, Literature, and Reference Card"** (pillar). Peer-reviewed references; MW/CAS/formula block; HPLC method; storage; solubility; literature table.
2. **"Peptide Reconstitution Calculator"** (tool). Shareable URLs, no registration, embeddable. Ranks fast on the calculator keyword cluster.
3. **"How to Read a Peptide COA"** (educational). Links to Janoshik-verified examples.
4. **"TB-500 — Mechanism, Literature, and Reference Card"** (pillar).
5. **"GHK-Cu / AHK-Cu — Copper-Peptide Reference"** (pillar).
6. **"CJC-1295 and Ipamorelin — Growth Hormone Secretagogue Reference"** (pillar).
7. **"Sermorelin — Literature and Reference Card"** (pillar).
8. **"Peptide Storage and Handling Reference"** (evergreen).
9. **"Epitalon, MOTS-c, Thymosin α-1 — Longevity Peptides Reference"** (cluster).
10. **"Selank, Semax — Nootropic Peptides Reference"** (cluster).

Deferred for launch window (enforcement-sensitive): anything titled "buy," anything that lists semaglutide/tirzepatide/retatrutide as a reference card until the regulatory picture stabilizes. Leave those for month 4+ conditional on landscape.

### 7.3 Five forum / community seeding tactics that are compliance-safe

1. **Sponsor the Peptide Source forum** ([peptidesource.net](https://peptidesource.net/forum/index.php)) or equivalent with disclosed sponsor status. Disclosure + real brand is fine; undisclosed sockpuppets are not.
2. **Publish a single, detailed vendor-due-diligence guide** and let the community link to it. Teach buyers to read COAs, verify Janoshik IDs, spot spiked products. Becomes a linkable resource.
3. **Open-source the peptide reconstitution calculator on GitHub** with MIT license. Linkable from Reddit / forums without tripping self-promotion rules.
4. **AMA on r/Peptides** once the Reddit rules permit (verify current rules each time). Transparent, brand-disclosed, no direct-selling.
5. **Janoshik partnership announcement** — once the COA integration is live, this is a legitimate news peg usable for a cross-post on bodybuilding and peptide forums; moderators generally accept verified third-party-testing announcements.

### 7.4 Partnerships to pursue

- **Janoshik Analytical** ([janoshik.com](https://janoshik.com/)) — third-party HPLC/MS, ISO-17025-accredited. Every batch. **Non-negotiable for the positioning.**
- **LifeTein or AAPPTec** — US custom synthesis for a 3–5 SKU flagship line. Use as marketing collateral ("synthesized in Louisville, KY" for those SKUs).
- **A peer-reviewed content reviewer** — an academic with a PhD in biochemistry or pharmacology, retained to stamp the mechanism-of-action pages. Real citation credibility.
- **Peptide review sites** — Muscle and Brawn, Outliyr, Peptide Dossier, PeptideDeck — these reach commercial-intent buyers. Engage as sponsored disclosures, not astroturf.

### 7.5 First-90-day risks and pre-emption

1. **FDA warning letter.** Mitigation: launch with no GLP-1 SKUs; no dosing copy; no testimonials; no benefits claims. Standard RUO disclaimer above the fold. Scope-of-sale acknowledgment at checkout. The December 2024 and September 2025 warning letters all follow the same template — your site should fail every one of the pattern checks.
2. **Payment rail denial** (ACH bounces, bank account freeze). Mitigation: have a second banking relationship pre-opened (regional or online-first bank); keep operating capital distributed.
3. **Customs seizure** (CBP intercepts a shipment). Mitigation: dual-source; stagger import cadence; never concentrate 60+ days of inventory in one shipment.
4. **State AG inquiry** (especially CA, NY, MA). Mitigation: pre-emptive geofence on minors; explicit shipping-policy exclusions to minors and to identified prescription pharmacies; record-keeping for verification events.
5. **Forum reputation attack** (competitor-seeded "scammed" posts). Mitigation: Janoshik-verified public lot database means any accusation can be rebutted with data. Set the response playbook in advance.
6. **Domain deplatforming** (registrar or host drops the site). Mitigation: domain registrar outside the US-parent registrars known to shut down peptide sellers (Namecheap, Tucows have been cooperative historically; not guaranteed). Registered offshore DNS fallback. Do not run the marketing site and the commerce backend on the same platform.
7. **Brand dilution** (copycat "Bench Grade" sellers). Mitigation: register wordmark trademark in class 5 (pharmaceutical research reagents) early; don't delay for budget reasons.
8. **Content scrape and re-use** (competitors copy the mechanism pages). Mitigation: the peer-reviewed reviewer partnership is hard to copy; the depth of the reference data is a moat.
9. **Founder personal liability from RUO as ruse**. Mitigation: hire a healthcare regulatory attorney *before* launch, not after. The DOJ cases (Tailor Made $1.79M forfeiture; the Kawa indictment) establish that personal liability is in play. This is the single most important line item in the legal budget.
10. **Supplier quality failure** (one bad AgeREcode lot kills reputation). Mitigation: every lot Janoshik-tested before it hits inventory; no batch released if HPLC < 98%; written kill-switch in the supplier agreement.

---

## Appendices

### A. Sources cited

- [FDA: Summit Research Peptides warning letter, Dec 10 2024](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters)
- [FDA Roundup, Dec 17 2024](https://www.fda.gov/news-events/press-announcements/fda-roundup-december-17-2024)
- [The Hill: FDA warns companies over unapproved weight loss drug sales](https://thehill.com/policy/healthcare/5046379-fda-warns-companies-unapproved-weight-loss-drugs/)
- [Wilson Sonsini: FDA Sends Warning Letters to 50+ GLP-1 Compounders and Manufacturers](https://www.wsgr.com/en/insights/fda-sends-warning-letters-to-more-than-50-glp-1-compounders-and-manufacturers.html)
- [Health Law Alliance: FDA Targets GLP-1 and Peptide Compounding, Advertising and "Research Use Only" Labeling](https://www.healthlawalliance.com/blog/fda-targets-glp-1-and-peptide-compounding-advertising-and-research-use-only-labeling)
- [Holt Law: The Unregulated World of Peptides](https://djholtlaw.com/the-unregulated-world-of-peptides-what-you-need-to-know-before-you-inject/)
- [Holt Law: Regulatory Status of Popular Compounded Peptides](https://djholtlaw.com/deep-dive-regulatory-status-of-popular-compounded-peptides/)
- [Peptide Examiner: FDA Peptide Enforcement 2025 Guide](https://peptideexaminer.com/articles/fda-peptide-enforcement-2025-guide/)
- [CBP: Cincinnati CBP foils scheme to smuggle over 5,000 unapproved peptides into the U.S.](https://www.cbp.gov/newsroom/local-media-release/cincinnati-cbp-foils-scheme-smuggle-over-5000-unapproved-peptides-us)
- [Clarke Esposito: CBP Seizes 5,000+ Peptide Shipments](https://www.clarkespositolaw.com/post/cbp-seizes-5-000-peptide-shipments-navigating-cbp-and-fda-lawyer-issues-as-an-importer)
- [ChinaTalk: Chinese Peptides](https://www.chinatalk.media/p/chinese-peptides)
- [FDA: FDA clarifies policies for compounders as national GLP-1 supply begins to stabilize](https://www.fda.gov/drugs/drug-alerts-and-statements/fda-clarifies-policies-compounders-national-glp-1-supply-begins-stabilize)
- [McDermott Will & Emery: Semaglutide Shortage Resolved](https://www.mwe.com/insights/semaglutide-shortage-resolved/)
- [NCPA: FDA ends compounding discretion for tirzepatide, maintains discretion for semaglutide](https://ncpa.org/newsroom/qam/2025/03/13/fda-ends-compounding-discretion-tirzepatide-maintains-discretion)
- [Alston & Bird: FDA Resolves Semaglutide Shortage — Next Steps](https://www.alston.com/en/insights/publications/2025/03/fda-resolves-semaglutide-shortage)
- [Foley: GLP-1 Drugs — FDA Removes Semaglutide from the Drug Shortage List](https://www.foley.com/insights/publications/2025/02/glp-1-drugs-fda-removes-semaglutide-from-drug-shortage-list/)
- [FTC: Final Order against NextMed (Dec 3 2025)](https://www.ftc.gov/news-events/news/press-releases/2025/12/ftc-approves-final-order-against-telehealth-provider-nextmed-over-charges-it-used-deceptive)
- [FTC: Action against NextMed (July 2025)](https://www.ftc.gov/news-events/news/press-releases/2025/07/ftc-takes-action-against-telemedicine-firm-nextmed-over-charges-it-used-misleading-prices-fake)
- [Holland & Knight: FDA, HHS Taking Action Against Telehealth's Compounded Drug Advertising](https://www.hklaw.com/en/insights/publications/2025/09/fda-hhs-taking-action-against-telehealths-compounded-drug-advertising)
- [Stevens & Lee: GLP-1 Weight Loss Drug Enforcement in 2025 — State AGs Step In](https://www.stevenslee.com/health-law-observer-blog/glp-1-weight-loss-drug-enforcement-in-2025-state-attorneys-general-step-into-a-growing-regulatory-gap/)
- [CT AG: Tong Sues GLP-1 Weight Loss Drug Distributor Triggered Brand](https://portal.ct.gov/ag/press-releases/2025-press-releases/attorney-general-tong-sues-glp-1-weight-loss-drug-distributor-triggered-brand)
- [DOJ: US v. Matthew Kawa (Paradigm Peptides)](https://www.justice.gov/usao-ndin/united-states-v-matthew-kawa)
- [Peptide Laws: Recent DOJ Actions Against Illegal Peptide Distributors](https://peptidelaws.com/news/recent-doj-actions-against-illegal-peptide-distributors)
- [DOJ USAO WDPA: Peptides Distributor Sentenced to Probation and Community Service](https://www.justice.gov/usao-wdpa/pr/peptides-distributor-sentenced-probation-community-service)
- [Muscle and Brawn: Amino Asylum Raided In 2025](https://muscleandbrawn.com/reviews/amino-asylum-raided-in-2025/)
- [Muscle and Brawn: Limitless Life Nootropics Review](https://muscleandbrawn.com/peptides/limitless-life-nootropics-review/)
- [Muscle and Brawn: Peptide Sciences Review (shutdown)](https://muscleandbrawn.com/peptides/peptide-sciences/)
- [Muscle and Brawn: 5 Best Peptide Vendors Compared in 2026](https://muscleandbrawn.com/peptides/best-peptide-vendors/)
- [Outliyr: The Only 13 Legit Top Peptide Companies Review 2026](https://outliyr.com/best-online-peptide-companies-websites-sources)
- [Peptide Dossier: Amino Asylum Review 2026](https://peptidedossier.com/guides/amino-asylum-review/)
- [Peptide Dossier: Peptide Sciences Shutdown](https://peptidedossier.com/guides/peptide-sciences-shutdown/)
- [Peptide Catalog: Why Peptide Sciences Really Shut Down](https://thepeptidecatalog.com/articles/what-happened-to-peptide-sciences)
- [PeptideDeck: Best Peptide Vendors 2026](https://www.peptidedeck.com/blog/best-legit-peptide-vendors-2026)
- [PeptideDeck: BPC-157 Review 2026 — includes search volume and KD data](https://www.peptidedeck.com/blog/bpc-157-vendor-review-2026)
- [Peptide Dossier: Amino Asylum Review 2026](https://peptidedossier.com/guides/amino-asylum-review/)
- [Peptides.org: Amino Asylum Review](https://www.peptides.org/amino-asylum-review/)
- [Sarmguide: Peptide Sciences vs SwissChems](https://sarmguide.com/peptide-sciences-vs-swisschems/)
- [Finnrick: Peptides Vendor Ratings](https://www.finnrick.com/vendors)
- [Kimera Chems](https://kimerachems.co/)
- [NextChems](https://nextchems.com/)
- [Element Sarms](https://www.elementsarms.com/)
- [Core Peptides](https://www.corepeptides.com/)
- [Prime Peptides Peptide Calculator](https://primepeptides.co/peptide-calculator/)
- [Prime Peptides Testing Protocols](https://primepeptides.co/testing/)
- [Peptide Fox Reconstitution Calculator](https://peptidefox.com/tools/calculator)
- [Limitless Life Nootropics](https://limitlesslifenootropics.com/)
- [Limitless Biotech Oral BPC-157 capsule launch — Yahoo Finance](https://finance.yahoo.com/news/limitless-biotech-introduces-oral-bpc-140000562.html)
- [Trustpilot: Limitless Life Nootropics Reviews](https://www.trustpilot.com/review/limitlesslifenootropics.com)
- [Trustpilot: Janoshik Reviews](https://www.trustpilot.com/review/janoshik.com)
- [Janoshik Analytical](https://janoshik.com/)
- [QSC Peptides: Janoshik COA Verification Guide](https://qsc-usa.com/janoshik-verification/)
- [Bachem](https://www.bachem.com/)
- [Bachem Custom Peptide Synthesis Services](https://www.bachem.com/custom-peptide-synthesis-services/)
- [AAPPTec](https://www.peptide.com/)
- [CPC Scientific](https://cpcscientific.com/)
- [GenScript Peptide Synthesis](https://www.genscript.com/peptide.html)
- [GenScript Large Scale Peptide Synthesis](https://www.genscript.com/peptide_large_scale.html)
- [GenScript contract pricing example — Iowa State University](https://www.procurement.iastate.edu/sites/default/files/Documents/Genscript%20Contract%20Pricing.pdf)
- [Tocris Bioscience](https://www.tocris.com/)
- [Cayman Chemical](https://www.caymanchem.com/)
- [Cayman CofA example](https://cdn.caymanchem.com/cdn/iso/19249-0703689-01-CofA.pdf)
- [Sigma-Aldrich](https://www.sigmaaldrich.com/US/en)
- [Mercury: Importing Research Peptides from China to US](https://www.shipmercury.com/blog/importing-research-peptides-from-china-to-us)
- [Token of Trust: Stay Legal Selling Peptides Online (2025)](https://tokenoftrust.com/blog/stay-legal-in-selling-peptides-online-2/)
- [Wallid: Age Verification for UK Research Peptide Sellers](https://wallid.co/blog/tpost/o3dr5pcar1-how-age-verification-protects-research-p)
- [Wallid: Selling Peptides on WooCommerce](https://wallid.co/blog/tpost/u8d8s9h8p1-selling-peptides-on-woocommerce-where-th)
- [Cenexa Labs Wholesale Program](https://cenexalabs.com/wholesale-program/)
- [Safe Medicines: Utah physician peptide case (Apr 6 2026)](https://www.safemedicines.org/2026/04/april-6-2026.html)
- [INTERPOL: 769 arrests, $65M illicit pharma seized](https://www.interpol.int/en/News-and-Events/News/2025/Record-769-arrests-and-USD-65-million-in-illicit-pharmaceuticals-seized-in-global-bust)
- [PubMed: BPC-157 literature review (2025)](https://pubmed.ncbi.nlm.nih.gov/40005999/)
- [Congressional testimony on knockoff weight-loss drugs from illegal foreign sources (Apr 2025)](https://www.congress.gov/119/meeting/house/118131/witnesses/HHRG-119-GO00-Wstate-SafdarS-20250409-SD001.pdf)
- [JSON-LD.com: Product Example Code](https://jsonld.com/product/)
- [Schema.org Product type](https://schema.org/Product)
- [GTech: JSON-LD for SEO beginner's guide](https://www.gtechme.com/insights/json-ld-for-seo-structured-data-guide/)
- [ProPublica: RFK Jr. on peptide policy reversal](https://www.propublica.org/article/peptide-safety-fda-compounding-pharmacies)
- [Peptide Source Forum](https://peptidesource.net/forum/index.php)

### B. Honest gaps in this report

- **Exact current pricing** for every competitor SKU requires live scraping and is not in scope for this document. The qualitative direction (median bands, archetype) is citable; per-vendor per-SKU pricing is not.
- **AgeREcode-specific supplier diligence** — the founder's memory identifies them as a candidate, not a confirmed supplier. This report assumes the category-typical Chinese-wholesaler risk profile.
- **MOQ/lead-time/pricing for Bachem, AAPPTec, LifeTein, GenScript** — these require direct RFQ and were not obtainable from public sources in the research window.
- **Current live FDA warning letters** — the December 2024 Summit letter URL returned a 404 during this research session (the FDA occasionally restructures the warning-letter archive). The letter's existence and contents are corroborated by multiple independent sources including The Hill, BioSpace, and industry legal commentators.
- **Internal financials of any named competitor** — private LLCs, not public companies, nothing authoritative available.
- **Keyword CPC data** — free-tool screenshots in the research window did not expose reliable CPC numbers. Validate via Ahrefs/SEMrush before spending.
- **Precise coded-name mappings** (e.g. "GLP-1 R" → retatrutide) — vendors reshuffle coded names frequently; research-window sources referenced the general pattern but did not expose a stable mapping. Verify against live competitor listings before adopting any code-name strategy — which, again, is not recommended.
