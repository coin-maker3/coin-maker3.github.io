# Paper draft — Results / Outcome-findings section

*Skeleton with placeholders `[…]`, written so every number maps to a cell on the Teams
workbook's Summary sheet (or is derivable from the raw columns). Fill as the dataset
matures; prose is written to publication register so it can be lifted into the
manuscript with minimal editing. Companion: Methods can cite the Build Record and
Audit Protocol.*

---

## Results

### Cohort

Between [start month] and [end month] 2026, [N total] consecutive 2WW lower-GI
referrals were reviewed. [n excl] cases ([x]%) met pre-specified exclusion criteria
([commonest exclusion reason], n=[…]; [second], n=[…]), leaving [N analysed] cases in
the concordance analysis. Median age was [xx] years ([IQR]), [x]% were female, and the
commonest referral reasons were [reason 1] ([x]%), [reason 2] ([x]%) and [reason 3]
([x]%). Cases were entered by [k] reviewers ([grades]).

> Source: Summary sheet — total rows, excluded count and reasons; age/sex/referral
> columns; Reviewer column.

### Primary outcome — concordance

The algorithm's recommendation matched the investigation requested by the reviewing
clinician in [n concordant] of [N analysed] cases (**[xx.x]%**, 95% CI [xx.x–xx.x]
[Wilson]). Chance-corrected agreement was [substantial/moderate/…] (Cohen's κ =
[0.xx], 95% CI [0.xx–0.xx]).

Concordance by recommendation arm:

| Algorithm recommendation | n | Concordant | % (95% CI) |
|---|---|---|---|
| Colonoscopy | […] | […] | […] |
| Colonoscopy + OGD | […] | […] | […] |
| CT colonography | […] | […] | […] |
| Colon capsule endoscopy | […] | […] | […] |
| Flexible sigmoidoscopy | […] | […] | […] |
| CT abdomen/pelvis | […] | […] | […] |
| Discuss with consultant of the week | […] | […] | […] |
| Discharge to GP | […] | […] | […] |

> Source: dashboard confusion matrix / per-arm table; Wilson CIs as per protocol §10.

### Discordant cases

Of [n discordant] discordant cases, the structured classification recorded by
reviewers was: clinician deviated for a valid reason the tool does not model, n=[…]
([x]%); clinically equivalent or trivial difference, n=[…]; transcription or data
difference, n=[…]; **algorithm error, n=[…]**; other, n=[…].

By safety direction, the clinician performed **more** investigation than the algorithm
recommended in [n] cases ([x]% of discordant cases) and **less** in [n] cases ([x]%).
[If clinician_less > 0: The [n] under-investigation-direction cases were reviewed
individually: (brief description of each — final diagnosis, whether any pathology
would have been missed at the algorithm-recommended depth of investigation).]

[If algorithm errors > 0: The [n] algorithm-error cases arose from [description];
these have been corrected in algorithm v[0.x] with regression tests added.]

> Source: Discordance reason / Discordance direction columns; dashboard Discordance
> analysis panel. The under-investigation review is manual — case-by-case, against
> final diagnosis.

### Cancer outcomes and the safety measure

A final diagnosis was available for [n dx] of [N analysed] cases ([x]%) at census date
[date]: colorectal cancer n=[…] ([x]%), other cancer n=[…], benign/no cancer n=[…],
not yet known n=[…].

Among the [n crc] colorectal cancers, the algorithm's recommendation was concordant
with, or deeper than, the clinician's chosen investigation in [n] cases. **In [n — the
pre-specified safety measure] cancer case(s), the algorithm recommended less
investigation than the clinician performed.** [If 0: In no cancer case did the
algorithm recommend less investigation than was actually performed — i.e. following
the algorithm would not have delayed or missed any cancer diagnosis in this cohort.]
[If >0: describe each case and whether the algorithm-recommended investigation would
still have detected the cancer.]

> Source: Summary sheet — cancer counts and the highlighted safety cell (cancers where
> the tool's recommendation was less than performed). This paragraph is the paper's
> headline safety finding either way.

### Subgroup analyses (pre-specified)

Concordance by referral reason, age band (<60 / 60–79 / ≥80) and bowel-prep fitness:

| Subgroup | n | Concordance % (95% CI) |
|---|---|---|
| [referral reason rows] | | |
| Age <60 / 60–79 / ≥80 | | |
| Fit / unfit for bowel prep | | |

[One sentence on whether any subgroup fell materially below the overall estimate.]

### Stop criteria

The protocol's stop criteria (overall concordance <60% at ≥25 cases, or any arm <50%
with ≥5 cases) were [not] triggered during the audit period.

---

## Notes for the Discussion (capture while fresh — not part of Results)

- Interpretation frame: high concordance validates the encoded pathway as a faithful
  decision aid; discordance dominated by "valid clinician deviation" defines exactly
  what a future version must model (e.g. prior surgical history), which was an
  anticipated limitation recorded before data collection.
- The under-investigation-direction × cancer cross-tab is the clinically decisive
  result; lead with it in the abstract whichever way it falls.
- Denominator transparency: excluded cases reported with reasons; no post-hoc
  exclusions.
- Limitations to acknowledge: single centre; retrospective transcription by reviewers
  (transcription-difference category quantifies this); final diagnoses right-censored
  at census date; reviewers not blinded to the tool's recommendation when recording
  the actual decision (mitigated by the actual decision being copied from the clinic
  letter, written before the tool existed for that case).
