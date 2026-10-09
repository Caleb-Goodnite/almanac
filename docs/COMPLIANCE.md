# Compliance notes

**This is an engineering summary, not legal advice, and Almanac does not claim to comply with any law.** It records what the app does, why, and what a qualified lawyer and a clinician need to review before real users, especially minors, are let in.

## What the app does today

### Age gate (13+)

- Sign-up starts with a full date of birth (month, day, year), not a checkbox. The question is asked neutrally: the form does not say which answers are accepted until after it is submitted.
- **Under 13:** no account is created. The date of birth is discarded in the same request and never stored or logged. The only thing kept is a cookie (`almanac_age_block`, 24 hours, httpOnly) that makes the form refuse further attempts from that browser, so the date cannot simply be re-entered.
- **13 and over:** a signed, one-hour cookie carries the month and year of birth to the account step. Only month and year are saved to the profile; the day is never stored.
- **Enforced on the server:** account creation is refused inside the auth library's "before user is created" hook unless that signed cookie is valid. This covers email sign-up and first-time Google sign-in, and calling the sign-up API directly without passing the gate, or with a forged cookie, returns 403. The token logic is unit-tested and the API refusal is covered by an end-to-end test.
- Age is recomputed from the stored month and year on every request, rounding toward younger, so a user moves out of the teen experience automatically in the month after they turn 18.

### What is stored about a person

| Data | Stored | Notes |
|---|---|---|
| Email, first name, password hash | Yes | Password hashing is handled by Better Auth (scrypt). |
| Month and year of birth | Yes | Day of birth is not stored. |
| Sex (optional, "prefer not to say" allowed), height | Yes | Used only for the energy formula. |
| Food, weight, measurements, workouts, sleep, mood | Yes | Health-related data the user enters. |
| Coach conversations | Yes | Per user; deleted with the account. |
| A parent or guardian's email, name and relationship | Only if an under-18 asks for fat-loss approval | See "Guardian approval" below. |
| IP address and user agent | Yes, on session rows | Collected by the auth library for session security. |
| Precise location, contacts, photos, advertising IDs | No | Camera access is used only for barcode scanning in the browser; frames are not uploaded. |

### What is sent to third parties

| Recipient | What | Why |
|---|---|---|
| OpenRouter, and the model provider it routes to | A structured summary of the user's recent numbers (age band, goal, targets, averages, trends) and the chat messages | The AI coach. Name, email, exact birth month and account id are never sent. |
| USDA FoodData Central, Open Food Facts | The search text or barcode | Food lookup. No user identifier is sent. |
| Google | Standard OAuth sign-in, only if the user chooses it | Authentication. |
| Resend | The recipient address and text of password-reset and guardian-approval emails | Sending email. |
| Supabase (or other Postgres host) | Everything in the database | Hosting. |

There is no advertising, analytics or tracking SDK in the app.

### User rights

- **Export:** a signed-in user can download everything held about them as JSON (Settings).
- **Deletion:** a signed-in user can delete their account. Every user-owned table references the user with `ON DELETE CASCADE`, so one delete removes all of it. Backups held by the database host are outside the app's control.

### Safety behaviour that has legal weight

- Under-18s get different targets and stricter limits (see `RESEARCH.md`, section 9).
- **An under-18 cannot set a fat-loss goal without a parent or guardian's approval.** The goal is not offered in onboarding or Settings, the server refuses it, and the target calculation plans no deficit for an under-18 without an approval on record (`guardianApproved` in `lib/science/targets.ts`). See "Guardian approval" below.
- Signals of disordered eating switch the app from optimising to supporting, and show helplines.
- A medical disclaimer is shown and must be acknowledged in onboarding, and appears in every page footer.
- "Support mode" is switched on automatically by strong signals in a coach message. An adult can switch it off again in Settings. An under-18 cannot: the server refuses, and the operator clears it with `pnpm support:clear <email>` after a parent, guardian or clinician has been involved. There is no in-app way for a parent to do this yet, so a false positive on a teen's account needs the operator.
- Sign-up is limited to the United States by default (`ALLOWED_COUNTRIES`), using the hosting platform's country header. This is best-effort, not an access control.
- Coach requests are restricted to zero-data-retention providers that do not train on prompts (`provider.data_collection: "deny"`, `zdr: true`). For under-18s the coach is given no calorie figures, no weight figures and no exact age band.
- The coach is limited to 10 replies per person per day. Crisis and support replies are not counted.

### Guardian approval for a fat-loss goal (13 to 17)

1. The teen enters a parent or guardian's email address in Settings. Their own address is refused, including plus-tag and Gmail-dot variants. Three requests a day at most.
2. That address receives one email with a single-use link that works for 7 days. Only a hash of the link token is stored.
3. The link opens a page that needs no account and shows only the teen's first name. The guardian must complete seven steps: read the risks (AAP position, growth, preoccupation with food), what the app is not, what limits it applies and what warning signs to watch for; tick three separate confirmations (that they are the parent or legal guardian and an adult, that they have read it, that they will supervise); give their full name and relationship; type "I understand the risks" (pasting is blocked); move a slider to the end; hold a button for five seconds; and confirm again in a final dialog.
4. The server checks every step again, and refuses an approval that arrives less than 15 seconds after the page was opened (a signed timestamp) or more than an hour after.
5. On approval the teen's goal becomes fat loss inside the teen limits, and the guardian gets a confirmation email with a link that withdraws the approval in one step. Withdrawing puts the teen back on maintenance targets immediately.
6. The approval lapses on its own when the user turns 18, because adults do not need it.

**What this is not.** It is not identity verification. The app cannot prove that the person who opened the email is a parent or guardian, or an adult, and a determined teen with a second email address can approve their own request. It raises the effort and the deliberateness of doing so, puts the risks in front of whoever approves, and leaves a record. It is not "verifiable parental consent" in the COPPA sense (which applies to under-13s, whom the app does not admit) and should not be described as such. Stronger methods (a card check, an ID check, a signed form) need a vendor and legal advice.

**Stored:** the guardian's email address, and after approval their name, relationship and the time. Deleted with the teen's account and included in their data export. The guardian is a second data subject: the privacy page says what is kept, and counsel should confirm the basis for holding it.

**Email dependency.** Without `RESEND_API_KEY` in production the request form says the feature is unavailable, so the goal simply stays locked.

## Needs legal review before launch

1. **COPPA (US).** The app is positioned as a general-audience service that screens out under-13s. Counsel should confirm that (a) the neutral age screen and 24-hour block meet the FTC's expectations, (b) keeping nothing but a block cookie is sufficient, and (c) a fitness app that expressly serves 13-17 year olds is not treated as "directed to children" given its design and marketing. The FTC amended the COPPA Rule in 2025; check current requirements.
2. **GDPR and UK GDPR, age of digital consent ("GDPR-K", Article 8).** The age at which a child can consent to data processing is 16 by default and member states may lower it to no less than 13 (for example 13 in the UK, 15 in France, 16 in Germany and the Netherlands). **The app currently applies 13 everywhere and has no parental-consent flow.** If it is offered in the EEA or UK, either raise the minimum age by country or add verifiable parental consent. This is the biggest known gap.
3. **Health data as special-category data (GDPR Article 9).** Weight, diet, sleep, mood and exercise are health data. Processing needs an explicit-consent basis, a Data Protection Impact Assessment, and probably a UK Age Appropriate Design Code assessment because under-18s are served. The onboarding acknowledgement is a medical disclaimer, not a GDPR consent, and should not be relied on as one.
4. **US state laws.** Washington's My Health My Data Act and similar laws in Nevada and Connecticut regulate consumer health data outside HIPAA and require a separate consumer health data privacy policy and consent. Several states also have teen-specific privacy and design-code laws. HIPAA itself likely does not apply (the app is not a covered entity), but counsel should confirm.
5. **International transfers and processors.** Data Processing Agreements are needed with the database host and OpenRouter, and the model provider's data-retention and training terms must be checked. OpenRouter lets an account restrict routing to providers that do not train on prompts; this should be turned on.
6. **Privacy policy and terms.** Plain-language drafts exist at `/privacy` and `/terms`, written to match what the code does and marked as drafts on the page. They have not been reviewed by a lawyer; the liability wording in particular is a placeholder.
7. **Email verification.** Email addresses are not verified at sign-up, which weakens both security and the validity of any consent. Password reset by emailed link exists and needs `RESEND_API_KEY` in production.
8. **Open Food Facts licence.** Its database is under the Open Database License (ODbL). The app caches individual product records and attributes the source in the UI. Counsel should confirm that this use does not create a "derivative database" that must itself be shared under ODbL.
9. **Medical device regulation.** The app gives general wellness information and avoids diagnosis or treatment claims. Counsel should confirm it stays within the FDA's general wellness policy and outside the EU Medical Device Regulation, particularly the adaptive calorie targets and the AI coach.

## Needs clinical review before launch

1. **Allowing 13-17 year olds to set a fat-loss goal at all.** This is a product decision by the app's owner, confirmed after an outside review recommended launching with it off, and later put behind guardian approval by the owner. A clinician should also review the wording of the risks shown to the guardian (`components/guardian/approval.tsx`). The American Academy of Pediatrics advises focusing on healthy habits rather than weight and warns that dieting is a risk factor for eating disorders (see `RESEARCH.md` refs 30, 31). The limits in `lib/safety/policy.ts` (maximum 0.5% of bodyweight per week, maximum 15% deficit, calories never below resting needs or 1,600/1,800 kcal, no deficit below the 25th BMI-for-age percentile) are cautious guesses by engineers, not clinical guidance. A paediatric dietitian or adolescent-medicine doctor should set or remove them.
2. **Adult calorie floors** (1,200 / 1,500 kcal) and the 25% maximum deficit.
3. **Disordered-eating detection.** The signal list and the wording of the support messages should be reviewed by an eating-disorder clinician. Keyword detection will miss cases and will sometimes fire wrongly; it is a backstop, not screening.
4. **Helpline list.** Currently US-only. It needs country-specific resources and a regular check that numbers are still in service.
5. **Showing weight and calorie numbers to minors by default.** Consider hiding weight trends for under-18s unless they opt in.

## Operational reminders

- Rotate the database password if it has ever been shared in plain text.
- Keep `BETTER_AUTH_SECRET` out of the repository; rotating it invalidates sessions and pending age-gate cookies.
- Re-run the age-gate tests after any upgrade of the auth library.
