/**
 * USPS-recognized 2-letter state, territory, and military codes.
 * Used by every form/server-action that accepts a US ship-to so the
 * field can't be set to a bogus 2-letter string. Kept as a `Set` for
 * O(1) membership checks; the underlying list is per the USPS pub-28
 * (state codes only — no district codes / county codes).
 */
export const US_STATES_AND_TERRITORIES: ReadonlySet<string> = new Set<string>([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP","AA","AE","AP",
]);
