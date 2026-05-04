# Records Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reset all operational record data and simplify the clinical flow to a single start-date field shown as `dd-mm-aaaa`.

**Architecture:** Keep the existing Next.js/Supabase architecture, but shrink the clinical field model, tighten date normalization around one canonical display format, and add one administrative reset script for destructive cleanup. Because the user base is small, record ordering can move from SQL string ordering to application-level parsed-date ordering.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Vitest, Playwright

---

### Task 1: Remove obsolete clinical fields from the domain model

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/record-utils.ts`
- Modify: `lib/ai-parser.ts`
- Modify: `lib/openrouter.ts`
- Test: `lib/ai-parser.test.ts`

- [ ] Remove `fecha_fin`, `hora_inicio`, `hora_fin`, `duracion` from `SurgicalFields`.
- [ ] Update `STANDARD_FIELD_ORDER`, empty-field helpers, normalizers and validations to use only `fecha_cirugia` plus remaining textual fields.
- [ ] Update AI aliases/prompt so extraction targets only the remaining fields and insists on `DD-MM-AAAA`.
- [ ] Update parser tests to cover `22-01-26 -> 22-01-2026` and `19-01-26 -> 19-01-2026`.
- [ ] Run: `npm test -- lib/ai-parser.test.ts`

### Task 2: Make date normalization and sorting match product expectations

**Files:**
- Modify: `lib/record-utils.ts`
- Modify: `app/(app)/records/page.tsx`
- Modify: `components/records/RecordListItem.tsx`
- Modify: `app/api/records/route.ts`
- Modify: `app/api/search/route.ts`

- [ ] Add helpers to normalize accepted date inputs into `dd-mm-aaaa`.
- [ ] Add helpers to parse `dd-mm-aaaa` for reliable server-side sorting.
- [ ] Replace SQL ordering that depended on ISO-like strings with application-level date sorting.
- [ ] Make record cards show the stored `dd-mm-aaaa` directly and remove time/duration badges.
- [ ] Verify records list and API still paginate correctly after sorting changes.

### Task 3: Update forms, exports, and duplicate flow to the new single-date model

**Files:**
- Modify: `components/records/FieldRow.tsx`
- Modify: `components/records/RecordForm.tsx`
- Modify: `components/records/NewRecordClient.tsx`
- Modify: `app/api/analyze/route.ts`
- Modify: `app/api/records/route.ts`
- Modify: `app/api/records/[id]/route.ts`
- Modify: `lib/export/excel.ts`
- Modify: `lib/export/pdf.tsx`
- Test: `app/api/analyze/route.test.ts`
- Test: `app/api/records/route.test.ts`

- [ ] Remove the deleted fields from the review form and labels.
- [ ] Keep analyze-created drafts, but make duplicate warnings explicit and non-silent.
- [ ] Ensure draft status is user-facing as `Borrador` in list UIs.
- [ ] Update create/update routes and exports to only use the remaining field set.
- [ ] Run targeted route tests and add assertions for the reduced payload shape.

### Task 4: Change page-size control to dropdown UX

**Files:**
- Modify: `app/(app)/records/page.tsx`

- [ ] Replace the inline page-size links with a single dropdown/select.
- [ ] Preserve values `10`, `20`, `50`, `100`.
- [ ] Reset page to `1` when page size changes.
- [ ] Verify query-string behavior manually in rendered links/form action.

### Task 5: Add destructive reset script for operational data

**Files:**
- Create: `scripts/reset-operational-data.mjs`
- Modify: `package.json`

- [ ] Write a script that uses Supabase service role credentials from `.env.local`.
- [ ] Delete all objects from `surgical-images`.
- [ ] Delete rows from `audit_log`, `invitations`, `custom_field_templates`, and `surgical_records`.
- [ ] Print counts before and after.
- [ ] Add script entry, e.g. `npm run reset:operational-data`.

### Task 6: Verify end-to-end and execute the data reset

**Files:**
- No code changes required unless verification finds a defect.

- [ ] Run: `npm test`
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`
- [ ] Run: `npm run reset:operational-data`
- [ ] Re-check row counts and bucket state with a one-off verification command.

### Task 7: Commit records-cleanup work

**Files:**
- Include only files changed for this spec.

- [ ] Stage the records-cleanup changes.
- [ ] Commit with a message focused on records cleanup.
