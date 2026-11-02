# Neurological record assistance

Scope: client-only reference, reviewed 2026-11-01. No AI calls, external patient-data transmission, automatic diagnosis, prescription, record mutation, new database or server changes. No claim of clinical validation, sensitivity, specificity or diagnostic probability. It is a conservative subset of clinical patterns, not a comprehensive veterinary diagnostic engine.

## Clinical interpretation

The aid uses explicitly recorded structured findings. Free text, patient species/age, onset/course, laboratory values, drugs and imaging are not automatically interpreted. These remain clinician inputs for narrowing broad, unranked differential categories. No treatment recommendation is generated. Suggestions are not added to signed assessment or localization, or to the clinical printout automatically.

Localization is withheld unless examination context is explicitly `awake` (no sedation). Sedation, other limitations and unknown context do not become normal. Urgent recorded findings may still prompt reassessment. Normal withdrawal does not establish conscious pain perception. Absence of a suggested pattern never excludes neurological disease.

Supported patterns: forebrain/diffuse brain, brainstem/diffuse brain, cerebellar, central/peripheral/undifferentiated vestibular, C1–C5, C6–T2, T3–L3, L4–S3/peripheral, generalized peripheral/neuromuscular. Requirements are executable in `clinicalAid` in `neuro-record.js`. They intentionally require explicit corroborating findings; these implementation gates are not a validated diagnostic rule. Cerebellar suggestion partly depends on the clinician's existing ataxia classification. Spinal gates require recorded normal mentation and selected bilateral cranial findings, not assumed absence of cranial disease. L4–S3 warns about spinal shock and peripheral alternatives. Multiple matches remain visible without numeric ranking or forced laterality.

UI shows the pattern, entered supporting observations, unranked differential categories, missing/unavailable core observations and source links. Deep-pain/mentation/ambulation prompts refer to recorded findings, do not infer prognosis, and do not replace examination.

## Sources

- [MSD Veterinary Manual: The Neurologic Examination of Animals](https://www.msdvetmanual.com/nervous-system/the-neurologic-examination/the-neurologic-examination-of-animals): domains, limitations, neuroanatomical localization; William B. Thomas, reviewed by Joyce Carnevale.
- [MSD: Degenerative Diseases of the Spinal Column and Cord](https://www.msdvetmanual.com/nervous-system/diseases-of-the-spinal-column-and-cord/degenerative-diseases-of-the-spinal-column-and-cord-in-animals): compressive disease examples and limitations of physical localization.
- [MSD: Otitis Media and Interna](https://www.msdvetmanual.com/ear-disorders/otitis-media-and-interna/otitis-media-and-interna-in-animals): peripheral vestibular signs and ear evaluation.
- [MSD: Initial Triage and Resuscitation](https://www.msdvetmanual.com/emergency-medicine-and-critical-care/evaluation-and-initial-treatment-of-small-animal-emergency-patients/initial-triage-and-resuscitation-of-small-animal-emergency-patients): neurological emergency reassessment and broad DAMNITV etiologic framework.

Original concise Korean paraphrases and independently implemented UI. No reproduction of source charts, images or full text.

## UX and access

Same pain button is idempotent; only explicit untested clears the finding. Read-only review filters never change stored findings. Recheck compares actual result changes separately from newly examined and untested/limited findings. Comparison detail reads are limited to six visible records at a time, at most three concurrent reads, only after user opens comparison; additional records require more. Loaded subset sorts by exam timestamp, without claiming a global date sort over unloaded records. Errors remain visible and can retry.

Lists reuse loaded pages; stale lists refresh after 60 seconds on return or idle focus, preserving page depth. Search filters use existing server `from`, `to`, `vet`. Identity scope guards and revisions remain enforced. Tests cover software behavior and clinical rule boundaries, not clinical diagnostic performance.

## Examination workflow (2026-11-02)

Patient age/sex is shown in the compact header. Examination context stays visible. Normal shortcuts affect one side; bulk results require explicitly selected examined sides. Unexamined values are never inferred. Filtered review supports targeted editing and return to the previous filter. Abnormal findings and evaluation limitations have separate summaries. Local aid explains missing context/results and links to missing observations, without changing clinician assessment or clinical rules. Prior details are reused for 60 seconds within the current record/scope; explicit refresh reloads them. Only an earlier same-patient exam is selected for initial comparison. Print uses grouped side-by-side matrices and allows further pages for long content.


## Examination workflow update (2026-11-02)
- Added Korean/English exam names using MSD Veterinary Manual, “The Neurologic Examination of Animals” terminology: https://www.msdvetmanual.com/nervous-system/the-neurologic-examination/the-neurologic-examination-of-animals (checked 2026-11-02). Field identifiers, clinical interpretation rules and saved exam values are unchanged.
- Section navigation retains the full form. Result filters retain left/right and limb positions, dimming excluded cells.
- The last ten local exam edits can be undone, including explicit-side bulk entry. Remote adoption, conflicts and record changes clear undo state.
- Recheck optionally imports history and plan separately; findings and examination context are always new.
- Chart summary copy includes manually entered findings, limitations, localization and plan. Generated clinical-aid suggestions are excluded. Clipboard-denied fallback remains selectable.
- Record completion is displayed separately from network save status. Failed completion remains pending.
- Free-text input no longer rebuilds findings/clinical aid on every keystroke. Open comparison updates are debounced; exam/context changes remain immediate.


## Review usability fixes (2026-11-02)
- Read-only filter results now use explicit text values, including local pain findings. Empty filters explain the absence of recorded results; they do not imply a normal examination.
- Validation expands all containing disclosures, focuses the invalid field and adds an inline error.
- The record header contains undo with the affected examination name, preserving existing scope/concurrency guards.
- Copied summaries include the record's patient identification, species, breed, age, sex and weight; no inferred values are introduced.
- Horizontal mobile section navigation has edge controls and reveals the active section without moving the page sideways.
- List and comparison dates include stored examination time. If the list response omits time, only viewport-visible records are read, at most two concurrently. A scope-local 60-second metadata cache prevents repeated reads. Missing time is explicit and request failure is retryable by refresh. No server endpoint or data schema is changed.


## Streamlined review and completion (2026-11-02)
- Section navigation preserves the selected results filter. Empty sections explain the lack of matching recorded results and offer an explicit switch to input; navigation never changes findings.
- Manual localization, assessment and plan precede an initially collapsed clinical-reference panel. Recorded urgent alerts remain visible outside it. Clinical rules are unchanged.
- Print scope and print action share one menu. Autosave is a compact status control, with explicit retry still visible after failure; undo and completion remain directly accessible.
- Copied summaries group explicitly normal findings by examination and side. Untested count is separate, and no untested side is inferred normal.
- Applied list search conditions have a single reset that clears query, status, dates, examiner and pagination, without modifying records.
- Prior comparison shows category counts and actual result changes immediately. Newly examined, untested/limited, clinical text and metadata groups expand on demand, preserving opened groups during edits.


## Reliability follow-up (2026-11-02)

- Rechecks use the preceding saved exam weight, including an empty weight, rather than overwriting it with directory weight. The initial source and subsequent manual edits are labelled.
- A failed complete/reopen action retains its intended status and request key; the action explicitly retries saving rather than reversing the pending intent.
- Changing the comparison clears the previous result immediately. Failure shows a selected-record retry without displaying mismatched results.
- Recently fetched visible-list detail is reused only after a matching server revision check. Expired or changed revisions fetch fresh detail; scope changes clear the cache. Failed checks do not open stale records.
- Search date validation happens before committing any filter; errors are inline and prior applied filters remain intact.
- Print loads the same bundled Korean font and waits before opening the print dialog. Font failure uses an explicitly reported system-font fallback.
- No clinical rules, server endpoints, stored patient records or database schema are changed.
