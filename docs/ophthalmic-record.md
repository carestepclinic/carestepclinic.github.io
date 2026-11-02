# Ophthalmic records

The clinical menu opens a full-width list with patient/guardian/chart search, examination date range, status and clinician. Existing registered patients and quick patients are supported. OD means the patient's right eye; OS means the patient's left eye.

The chart stores independent bilateral measurements, reflexes, anatomy findings, corneal lesion coordinates and dimensions, eye-specific prescription plans, follow-up and guardian guidance. Empty fields remain unexamined, including when the other eye is normal. Reflex results do not infer vision. Numeric input bounds reject impossible input; they are not normal reference intervals or diagnostic thresholds.

Saved records autosave edited fields with revision checks. A failed request retains the same request key for retries; concurrent edits retain local input and require explicit reconciliation. Creating a recheck carries identity and previous exam weight, but never findings, diagnoses or prescriptions. The previous-record comparison supplies STT/IOP trends without interpolating unmeasured examinations.

Photos are bounded JPEG previews (four per record), not diagnostic-quality original storage. Originals remain the clinic's responsibility. Existing encrypted clinical case/event storage contains the metadata and previews; image bytes are fetched only when requested. No new database or bucket is required. Clinical record permissions and hospital scope apply to all endpoints. Existing patient records are not modified by creating or editing an examination.

Print/PDF includes identity, OD/OS measurements and findings, lesion diagrams, prescription laterality and saved photos. Guardian text is copy-only; it does not send or publish to HOME.

## References reviewed 2026-11-02

- Merck Veterinary Manual, Physical Examination of the Eye in Animals: https://www.merckvetmanual.com/eye-diseases-and-disorders/ophthalmology/physical-examination-of-the-eye-in-animals
- Stiles and Kimmitt, 2016, Eye examination in the cat: https://pmc.ncbi.nlm.nih.gov/articles/PMC11148898/
- Pinard, 2023, Ocular Examination Diagnostic Tests (abstract): https://pubmed.ncbi.nlm.nih.gov/36813386/
- TONOVET instrument measurement information: https://tonovet.com/faq/

The helper text places STT before topical medication or lavage, culture sampling before surface treatment when indicated, and IOP assessment before dilation. Suspected deep ulceration or perforation requires clinician judgment rather than mandatory contact tests. No automatic diagnosis, drug recommendation or normal-result generation is performed.
