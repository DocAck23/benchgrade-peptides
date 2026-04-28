# Affiliate portal — manual setup (W6)

The migration `0022_affiliate_portal.sql` creates the three tables
(`affiliate_invites`, `affiliate_agreements`, `affiliate_w9`), enables
RLS on each, and writes the storage RLS policies for the `affiliate-w9`
bucket. **The bucket itself must be created manually** before the W9
upload flow works end to end.

## 1. Create the private Storage bucket

1. Open the Supabase dashboard → **Storage** → **New bucket**.
2. Name: `affiliate-w9` (exact, lowercase, hyphenated).
3. Public bucket: **OFF**.
4. File size limit: **5 MB** (matches server-side guard in
   `uploadAffiliateW9`).
5. Allowed MIME types: `application/pdf` (optional — the server action
   already enforces this).
6. Save.

## 2. Verify RLS policies

Migration `0022` has already applied:

- `public.affiliate_invites` — owner read of their own consumed row
- `public.affiliate_agreements` — owner read of their own signatures
- `public.affiliate_w9` — owner read of their own ledger rows
- `storage.objects` — `affiliate_w9_owner_select` and
  `affiliate_w9_owner_insert`, both scoped to
  `bucket_id = 'affiliate-w9' AND (storage.foldername(name))[1] = auth.uid()::text`

In the dashboard go to **Storage → Policies** and confirm both
`affiliate_w9_owner_*` policies are listed against `storage.objects`.
No additional INSERT/UPDATE/DELETE policies are needed on the
public-schema tables — every write goes through the service-role
client.

## 3. Generate the first invite

1. Sign in to `/admin/login` with `ADMIN_PASSWORD`.
2. Open `/admin/affiliates`.
3. (Optional) Add an internal note (e.g. "Spring 2026 cohort") and
   expiry in days.
4. Click **Generate invite**. The one-time URL appears with a copy
   button.
5. Send it through your normal channel.

## 4. End-to-end smoke test (founder dress rehearsal)

1. Generate an invite as above. Copy the URL.
2. Open the URL in an **incognito window** (different cookie jar).
3. The invite landing prompts for sign-in. Use the magic-link flow.
4. After auth, the page redirects to `/account/affiliate-onboarding`.
5. Read the agreement, type your full legal name, click **Sign**.
6. Upload any small PDF as a stand-in W9.
7. Open `/admin/affiliates` in your admin browser. The new affiliate is
   listed with all three pills green.
8. Click the row to open the detail page. The signed agreement HTML
   renders inline; the **Download (5 min)** button mints a fresh
   signed URL. Click and confirm the PDF downloads.
9. Back in the affiliate's `/account/affiliate` dashboard, the new
   **Documents** section shows the same agreement metadata and a
   **Download (5 min)** button on the W9.
10. Try to fetch the W9 storage path directly from a logged-out browser
    (`<SUPABASE_URL>/storage/v1/object/public/affiliate-w9/<uid>/<file>.pdf`).
    Expect a 4xx — the bucket is private and there is no public-read
    policy.
11. Re-open the original invite URL in another incognito window.
    Expect "This invite has already been used."

## 5. Re-uploading a W9

The ledger is append-only. Uploading a new W9 marks the previous row's
`superseded_at` and inserts a fresh row. The dashboard always shows the
current (un-superseded) row.

## 6. Versioning the agreement

The current version string is `1099-v1-2026-04-27` (see
`src/lib/affiliate/agreement-1099-v1.ts`). To revise:

1. Add a new file `agreement-1099-v2-YYYY-MM-DD.ts` exporting
   `AGREEMENT_HTML` and `AGREEMENT_VERSION`.
2. Switch the import in `src/app/actions/affiliate-portal.ts` and
   `src/app/account/affiliate-onboarding/page.tsx`.
3. Existing signed rows keep their snapshot HTML and old version
   string — they remain valid evidence of the earlier agreement.
