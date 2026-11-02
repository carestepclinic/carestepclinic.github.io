# Chronic monitoring review — 2026-11-02

This review covers the form's seven disease templates, not the appropriateness of an individual patient's treatment. All fields are optional except identity/date/condition; previous results are comparison-only. Selecting a condition or visit purpose does not diagnose, stage, prescribe, or mark an unperformed test normal.

| Template | Primary follow-up display | Additional / diagnostic evaluation |
|---|---|---|
| CKD | Weight, creatinine, SDMA, BUN, phosphorus, blood pressure, potassium, UPC | Urinalysis/USG, CBC, calcium, TCO2 and other chemistry according to stage and status |
| Diabetes | Weight, clinical signs, glucose, fructosamine, glucose curve/CGM notes | CBC, renal/hepatic chemistry, urinalysis, lipids, blood pressure; culture when infection suspected. Feline SGLT2 selection promotes blood BHB |
| Cardiac | Weight, resting respiratory rate, heart rate, blood pressure, renal values and potassium | Echocardiography/imaging, ECG, NT-proBNP and cTnI by indication; TT4 offered in cats, LVIDDN contextualized for dogs |
| Cushing | Clinical signs, weight, sodium, potassium, glucose | Chemistry/urinalysis/BP; selected pre-dose/ACTH cortisol monitoring with consistent sampling. LDDST displayed as diagnostic evaluation |
| Addison | Signs, weight, Na/K/Cl, renal values and glucose | DOCP timing with electrolytes; ACTH stimulation for diagnosis/reassessment, not a universal repeated follow-up requirement |
| Hypothyroidism | Weight, clinical response, TT4 with dose/sample timing | TSH/fT4, lipids and CBC as indicated. Canine approach is not automatically applied to cats |
| Hyperthyroidism | Weight, TT4, heart rate, renal values and BP | CBC, liver enzymes, urinalysis and additional thyroid testing according to treatment and response |

Primary display is a usability prioritization, not a mandatory minimum panel or fixed schedule. Multiple disease selections combine relevant fields; all entered data remain visible even after deselection. Biomarkers are not replaced with automatic treatment decisions. Feline in-clinic glucose curves are not presented as a routine requirement.

## Sources reviewed
- IRIS CKD recommendations: https://www.iris-kidney.com/iris-guidelines-1
- AAHA 2026 canine insulin monitoring: https://www.aaha.org/resources/2026-aaha-diabetes-management-guidelines-for-dogs/section-5-monitoring-dogs-receiving-insulin/
- AAHA 2026 feline glucose monitoring: https://www.aaha.org/resources/2026-aaha-diabetes-management-guidelines-for-cats/section-13-glucose-monitoring/
- AAHA 2026 feline SGLT2 monitoring: https://www.aaha.org/resources/2026-aaha-diabetes-management-guidelines-for-cats/section-6-sglt2-inhibitor-treatment-and-monitoring/
- AAHA 2023 selected endocrinopathies (therapy sections): https://www.aaha.org/resources/2023-aaha-selected-endocrinopathies-of-dogs-and-cats-guidelines/
- ACVIM feline cardiomyopathies: https://pmc.ncbi.nlm.nih.gov/articles/PMC7255676/
- ACVIM canine MMVD: https://pmc.ncbi.nlm.nih.gov/articles/PMC6524084/
- Laboratory unit conversion: https://www.mayocliniclabs.com/order-tests/si-unit-conversion.html and https://www.labcorp.com/test-menu/resources/si-unit-conversion-table

## Data rules
Alternative units retain numeric input and unit alongside validated canonical values. Comparison does not imply assay interchangeability or a universal reference interval. Thyroid, cortisol, and DOCP/electrolyte contexts are separate; elapsed dose/sample time is calculated, not prefilled. The older common context remains accessible. Text reused from earlier visits stores attribution separately and refuses overflow instead of silently truncating. Printed summaries include all entered numeric results, observation categories, and laboratory notes; long records continue onto further pages. Photos load only when selected for printing.

Context uses authenticated clinic/patient filtering plus a cursor; quick patients remain linked by encounter IDs, never by name. No patient records are backfilled by deployment.
