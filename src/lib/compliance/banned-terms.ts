/**
 * Bench Grade Peptides — compliance banned-terms list.
 *
 * Source: memory/ruo_compliance_framework.md §3
 *
 * These patterns must NEVER appear in customer-facing copy. They represent
 * language the FDA treats as evidence of drug-claim intent under
 * 21 USC § 321(g)(1) and the intended-use doctrine at 21 CFR § 201.128.
 *
 * Design principle after Phase 2 codex review:
 *
 *   Every pattern MUST require claim context (a therapeutic verb paired with
 *   a body part, disease, outcome, or subject-address).
 *
 *   Standalone disease words, body-part words, or verbs that would also
 *   appear in legitimate scientific research descriptions are NOT in this
 *   list. The linter is a backstop against marketing drift, not a
 *   comprehensive content filter — a scientific research description of
 *   "bone healing models in rodents" is legitimate and must pass.
 *
 * What the linter catches (claim patterns):
 *   - Therapeutic verbs paired with 2nd-person or disease objects
 *     ("cures your joints", "treats arthritis", "reduces inflammation")
 *   - "For [specific disease]" constructions
 *   - Outcome claims ("weight loss", "muscle growth")
 *   - Stacking/protocol language
 *   - First-person testimonial language
 *   - Branded-drug comparisons
 *
 * What it deliberately does NOT catch:
 *   - Standalone disease names in research context ("cancer cell line",
 *     "arthritis research literature")
 *   - Scientific verbs in mechanism descriptions ("binds", "modulates")
 *   - The word "healing" in wound/tissue research context
 *   - The word "inflammation" in anti-inflammatory research context
 *
 * Enforcement is in `complianceLint()` below. Run pre-publish on every
 * customer-facing surface.
 */

export type BannedCategory =
  | "therapeutic_claim"
  | "disease_in_claim_context"
  | "outcome_claim"
  | "dosing_language"
  | "bundling_language"
  | "testimonial_language"
  | "branded_drug_comparison";

export interface BannedTerm {
  pattern: RegExp;
  category: BannedCategory;
  rationale: string;
}

/**
 * Terms are matched case-insensitively. All patterns require claim context.
 * When adding new patterns: include a note about what scientific usage it
 * must NOT match (the false-positive surface).
 */
export const BANNED_TERMS: BannedTerm[] = [
  // --- Therapeutic verbs in subject/object context ---
  // "heals your joints", "treats the condition", "cures my pain"
  {
    pattern: /\b(heal|heals|cure|cures|treat|treats|prevent|prevents|mitigate|mitigates|relieve|relieves|reduce|reduces|fight|fights|combat|combats)\s+(?:your|my|their|his|her|the|any|a|an)\s+(?:joints?|muscles?|pains?|skin|mood|sleep|anxiety|depression|symptoms?|conditions?|inflammation|swelling|injury|injuries|infections?|illnesses?|diseases?|cold|flu|arthritis|diabetes|obesity)/i,
    category: "therapeutic_claim",
    rationale: "Core FDA drug-claim pattern — therapeutic verb + subject body-part/condition. 21 USC § 321(g)(1).",
  },
  // "supports your joints", "promotes healthy skin", "boosts your immune system"
  {
    pattern: /\b(supports?|promotes?|boosts?|enhances?|improves?|strengthens?)\s+(?:your|my|their|his|her|the|a|an|healthy)\s+(?:joints?|muscles?|skin|brain|liver|gut|mood|memory|libido|sleep|recovery|energy|performance|immune|immunity|digestion|metabolism|health|wellness|vitality|longevity)/i,
    category: "therapeutic_claim",
    rationale: "Structure-function claim. Protected in DSHEA for dietary supplements; RUO peptides are NOT supplements and cannot use this framing.",
  },
  // "relieves pain", "reduces inflammation" (no 2p qualifier)
  {
    pattern: /\b(relieves?|reduces?|eliminates?|fights?)\s+(?:pain|inflammation|swelling|fatigue|stress|anxiety|depression|arthritis|insomnia)\b/i,
    category: "therapeutic_claim",
    rationale: "Active-voice outcome claim without 2p qualifier — still a drug claim.",
  },

  // --- Disease name in claim/marketing context ---
  // "for arthritis", "for weight loss", "helps with anxiety"
  {
    pattern: /\b(?:for|helps?\s+with|used\s+to|intended\s+(?:to|for))\s+(arthritis|osteoarthritis|diabetes|obesity|overweight|anxiety|depression|insomnia|IBD|crohn'?s|colitis|IBS|alzheimer'?s|parkinson'?s|dementia|cancer|autoimmune|lupus|erectile\s+dysfunction|impotence)/i,
    category: "disease_in_claim_context",
    rationale: "Specific disease targeting — the classic drug-claim construction.",
  },
  // "weight loss", "fat loss" — highly enforced outcome
  {
    pattern: /\b(weight[\s-]?loss|fat[\s-]?loss|slimming|weight[\s-]?management\s+(?:solution|product|supplement))\b/i,
    category: "outcome_claim",
    rationale: "Direct GLP-1 enforcement trigger — Dec 2024 FDA warning letters hit exactly this language.",
  },
  // "muscle growth", "lean mass"
  {
    pattern: /\b(muscle[\s-]?(?:growth|gain|building)|lean\s+mass|bodybuilding\s+supplement)\b/i,
    category: "outcome_claim",
    rationale: "SARMs-era enforcement pattern; performance-enhancement intent.",
  },
  // "anti-aging", "longevity solution"
  {
    pattern: /\banti[\s-]?(?:aging|age|anxiety|depression|inflammatory\s+(?:solution|supplement|product))\b/i,
    category: "outcome_claim",
    rationale: "Outcome-as-category marketing claim — FDA treats as structure-function.",
  },
  // "recovery boost", "performance enhancement"
  {
    pattern: /\b(recovery|performance|longevity)\s+(?:boost|enhancement|improvement|optimizer)\b/i,
    category: "outcome_claim",
    rationale: "Outcome-chain language — athletic/recovery use intent.",
  },
  // "before and after", "transformation"
  {
    pattern: /\b(before\s*(?:and|\/|&)\s*after|transformation\s+(?:stor|photo|result))/i,
    category: "outcome_claim",
    rationale: "Outcome imagery language.",
  },

  // --- Dosing language (subject administration instruction) ---
  // "2 mg/kg body weight"
  {
    pattern: /\b\d+(?:\.\d+)?\s*mg\s*\/\s*kg\b/i,
    category: "dosing_language",
    rationale: "Body-weight dosing implies subject administration.",
  },
  // "inject daily", "take each morning", "administer twice per day"
  {
    pattern: /\b(take|inject|administer|dose)\s+(?:it\s+)?(?:daily|each|every|once|twice|thrice|per)\b/i,
    category: "dosing_language",
    rationale: "Direct administration instruction targeted at the reader.",
  },
  // "before bed", "morning dose", "post-workout"
  {
    pattern: /\b(before\s+bed|at\s+bedtime|morning\s+dose|post[\s-]?workout|pre[\s-]?workout)\b/i,
    category: "dosing_language",
    rationale: "Subject-regimen temporal context.",
  },
  // "inject subcutaneously", "subq injection" in 2p context — narrowed
  {
    pattern: /\b(subcutaneous|subq|intramuscular|IM)\s+(injection|shot)\s+(?:daily|weekly|before|after|into\s+(?:your|the))/i,
    category: "dosing_language",
    rationale: "Administration route + temporal/subject context — NOT generic 'subcutaneous injection in rodent models' research description.",
  },

  // --- Bundling / stacking / protocol language ---
  // "stack with", "cycle with", "run a protocol"
  {
    pattern: /\b(stack\s+(?:with|it\s+with)|cycle\s+(?:with|of\s+\w+\s+mg)|run\s+(?:a|the)\s+(?:protocol|cycle|regimen)|combine\s+with\s+\w+\s+for)/i,
    category: "bundling_language",
    rationale: "Stacking/cycling implies use-case for subject administration.",
  },

  // --- Testimonial / first-person use language ---
  // "I tried this and it worked"
  {
    pattern: /\bI\s+(?:tried|used|took|injected|noticed|felt|experienced)\s+(?:this|it|the|a)/i,
    category: "testimonial_language",
    rationale: "First-person use testimony = self-reported consumption.",
  },
  {
    pattern: /\b(customer\s+results|user\s+experiences?|success\s+stories?|transformation\s+stories?)\b/i,
    category: "testimonial_language",
    rationale: "Results-based marketing framing.",
  },

  // --- Branded drug comparisons ---
  {
    pattern: /\b(?:like|generic|similar\s+to|alternative\s+to|equivalent\s+to|version\s+of)\s+(ozempic|wegovy|mounjaro|zepbound|saxenda)\b/i,
    category: "branded_drug_comparison",
    rationale: "Comparative claim to FDA-approved branded drug — per Dec 2024 warning letters.",
  },
  {
    pattern: /\b(ozempic|wegovy|mounjaro|zepbound|saxenda|rimadyl|apoquel|cytopoint)\b/i,
    category: "branded_drug_comparison",
    rationale: "Any mention of a branded FDA-approved drug in marketing context.",
  },
];

export interface ComplianceViolation {
  term: string;
  category: BannedCategory;
  rationale: string;
  position: number;
  context: string;
}

/**
 * Scan a body of text for banned claim patterns. Returns an array of violations.
 * Empty array = content passes.
 */
export function complianceLint(text: string): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const term of BANNED_TERMS) {
    const flags = term.pattern.flags.includes("g") ? term.pattern.flags : term.pattern.flags + "g";
    const pattern = new RegExp(term.pattern.source, flags);

    for (const match of text.matchAll(pattern)) {
      const position = match.index ?? 0;
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(text.length, position + match[0].length + 30);
      violations.push({
        term: match[0],
        category: term.category,
        rationale: term.rationale,
        position,
        context: text.slice(contextStart, contextEnd).trim(),
      });
    }
  }

  return violations;
}

/**
 * Asserting variant — throws on violations. Use in build-time scripts and server actions.
 */
export function assertCompliant(text: string, source?: string): void {
  const violations = complianceLint(text);
  if (violations.length > 0) {
    const sourceInfo = source ? ` in ${source}` : "";
    const summary = violations
      .map((v) => `  [${v.category}] "${v.term}" — ${v.rationale}\n    context: "…${v.context}…"`)
      .join("\n");
    throw new Error(
      `Compliance violations detected${sourceInfo}:\n${summary}\n\nSee memory/ruo_compliance_framework.md §3 for the full banned-terms list.`
    );
  }
}
