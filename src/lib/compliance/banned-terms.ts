/**
 * Bench Grade Peptides — Compliance banned-terms list.
 *
 * Source: /Users/ahmed/.claude/projects/-Users-ahmed-Research-Only-Peptides/memory/ruo_compliance_framework.md §3
 *
 * These terms must NEVER appear in:
 *   - Product titles, descriptions, or meta tags
 *   - Blog content
 *   - Email templates
 *   - Social copy
 *   - Ad creative
 *   - FAQ answers
 *
 * Enforcement: the `complianceLint()` function below is run:
 *   1. Pre-publish on product pages (CI check)
 *   2. On every CMS write via server action
 *   3. On every outbound email render
 *
 * Any match is a hard block, not a warning.
 *
 * Keep this file ungated — it is intentionally public as an
 * affirmative-defense artifact showing compliance-as-code.
 */

export type BannedCategory =
  | "therapeutic_verb"
  | "disease_name"
  | "body_part_health_context"
  | "outcome_claim"
  | "dosing_language"
  | "administration_route"
  | "bundling_language"
  | "testimonial_language"
  | "branded_drug_comparison";

export interface BannedTerm {
  pattern: RegExp;
  category: BannedCategory;
  rationale: string;
}

/**
 * Terms are matched case-insensitively with word boundaries where applicable.
 * When adding: include the rationale so future reviewers understand why.
 */
export const BANNED_TERMS: BannedTerm[] = [
  // --- Therapeutic verbs (in biological-function context) ---
  { pattern: /\b(heals?|healing|cures?|treats?|treatment|prevents?|prevention|mitigates?|relieves?|reduces?)\b/i, category: "therapeutic_verb", rationale: "Core FDA drug-claim trigger — 21 USC § 321(g)(1)" },
  { pattern: /\b(improves?|boosts?|enhances?|supports?)\s+(?:your|the|immune|joint|muscle|skin|brain|liver|gut|mood|memory|libido|sleep|recovery|energy|performance|health|wellness)\b/i, category: "therapeutic_verb", rationale: "Structure-function verbs become drug claims when paired with body systems in marketing context" },

  // --- Disease names (common RUO enforcement triggers) ---
  { pattern: /\b(arthritis|osteoarthritis|rheumatoid)\b/i, category: "disease_name", rationale: "Specific diagnosis — drug claim under 21 USC § 321(g)" },
  { pattern: /\b(obesity|overweight|weight[\s-]?loss|fat[\s-]?loss)\b/i, category: "disease_name", rationale: "GLP-1 enforcement trigger — Dec 2024 warning letters" },
  { pattern: /\b(diabetes|diabetic|type[\s-]?2|insulin[\s-]?resistance)\b/i, category: "disease_name", rationale: "FDA-regulated condition" },
  { pattern: /\b(depression|anxiety|PTSD|bipolar|insomnia)\b/i, category: "disease_name", rationale: "Mental health conditions are drug-claim triggers" },
  { pattern: /\b(erectile\s+dysfunction|ED\b|impotence|libido)\b/i, category: "disease_name", rationale: "Tainted-supplement enforcement pattern (sildenafil precedent)" },
  { pattern: /\b(IBD|crohn'?s|colitis|IBS|leaky\s+gut)\b/i, category: "disease_name", rationale: "GI conditions" },
  { pattern: /\b(alzheimer'?s|parkinson'?s|dementia|cognitive\s+decline)\b/i, category: "disease_name", rationale: "Neurological disease claims" },
  { pattern: /\b(cancer|tumor|malignan|carcinoma|oncology)\b/i, category: "disease_name", rationale: "Highest-scrutiny disease category" },
  { pattern: /\b(autoimmune|lupus|multiple\s+sclerosis)\b/i, category: "disease_name", rationale: "Autoimmune disease claims — note: standalone 'MS' is excluded to avoid false positives with mass spectrometry; watch for it in context review" },
  { pattern: /\binflammation\b/i, category: "disease_name", rationale: "Symptom-as-condition language" },

  // --- Body parts in health context (caught in therapeutic_verb too; these are extra belt-and-braces) ---
  { pattern: /\b(your|the)\s+(joints?|muscles?|skin|brain|liver|gut|mood|memory|libido|energy)\b/i, category: "body_part_health_context", rationale: "Second-person body references imply human/animal subject use" },

  // --- Outcome claims ---
  { pattern: /\b(longevity|anti[\s-]?aging|age[\s-]?reversal)\b/i, category: "outcome_claim", rationale: "Structure-function claim under FDA scrutiny" },
  { pattern: /\b(muscle\s+growth|muscle\s+gain|lean\s+mass|bodybuilding)\b/i, category: "outcome_claim", rationale: "SARMs-era enforcement pattern" },
  { pattern: /\b(recovery|performance)\s+(?:enhancement|boost|improvement)\b/i, category: "outcome_claim", rationale: "Athletic-use intent language" },
  { pattern: /\b(before\s*(?:and|\/|&)\s*after|transformation)\b/i, category: "outcome_claim", rationale: "Outcome imagery language" },

  // --- Dosing language ---
  { pattern: /\b\d+\s*mg\s*\/\s*kg\b/i, category: "dosing_language", rationale: "Body-weight dosing = human/animal subject intent" },
  { pattern: /\b(take|inject|administer|dose)\s+(?:daily|each|every|once|twice|per)\b/i, category: "dosing_language", rationale: "Direct administration instruction" },
  { pattern: /\b(before\s+bed|morning\s+dose|post[\s-]?workout)\b/i, category: "dosing_language", rationale: "Subject-regimen context" },

  // --- Administration routes in subject context ---
  { pattern: /\b(subcutaneous|subq|intramuscular|IM\s+injection|intranasal|sublingual)\s+(?:injection|administration|use)\b/i, category: "administration_route", rationale: "Clinical administration route = consumption intent" },

  // --- Bundling / stacking language ---
  { pattern: /\b(stack|protocol|cycle|regimen|combo|combine\s+with)\b/i, category: "bundling_language", rationale: "Stacking implies use-case for administration" },

  // --- Testimonial / review language ---
  { pattern: /\b(I\s+(?:tried|used|took|injected|noticed|felt))\b/i, category: "testimonial_language", rationale: "First-person use testimony = self-reported human use" },
  { pattern: /\b(customer\s+results|user\s+experiences?|success\s+stor)/i, category: "testimonial_language", rationale: "Results-based marketing" },

  // --- Branded drug comparisons ---
  { pattern: /\b(like|generic|similar\s+to|alternative\s+to|equivalent\s+to)\s+(ozempic|wegovy|mounjaro|zepbound|saxenda)/i, category: "branded_drug_comparison", rationale: "Comparative claims to FDA-approved drugs — per Dec 2024 warning letters" },
  { pattern: /\b(ozempic|wegovy|mounjaro|zepbound|saxenda|rimadyl|apoquel|cytopoint)\b/i, category: "branded_drug_comparison", rationale: "Branded-drug references are drug-claim triggers" },
];

export interface ComplianceViolation {
  term: string;
  category: BannedCategory;
  rationale: string;
  position: number;
  context: string;
}

/**
 * Scan a body of text for banned terms. Returns an array of violations.
 * Empty array = content passes.
 */
export function complianceLint(text: string): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const term of BANNED_TERMS) {
    // Need to clone the regex to iterate with matchAll regardless of original flags
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
      `Compliance violations detected${sourceInfo}:\n${summary}\n\nSee /Users/ahmed/.claude/projects/-Users-ahmed-Research-Only-Peptides/memory/ruo_compliance_framework.md §3 for the full banned-terms list and rationale.`
    );
  }
}
