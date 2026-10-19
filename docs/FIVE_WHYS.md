# Five whys

Two levels: first the problem this concept exists to solve, then the method applied to one incident from the sample data. Each RCA in the app carries its own five whys too.

## 1. Why does a payroll product need a product ops operating system?

**Symptom:** statutory payroll defects reach employees' bank accounts before they reach the top of the backlog.

| # | Why? | Answer |
|---|---|---|
| 1 | Why do defects reach payslips first? | Because they weren't prioritised in time, even though signals existed weeks earlier. |
| 2 | Why weren't they prioritised? | Because the backlog was ranked by volume and loudness, and a low-volume compliance issue looks small next to a high-volume UX complaint. |
| 3 | Why rank by volume? | Because volume is the only number every channel has. Accounts affected, ARR exposure and compliance risk weren't captured at intake. |
| 4 | Why weren't they captured? | Because intake had no owner, no required fields and no shared definition of a "theme". Each channel logged in its own tool. |
| 5 | Why no owner? | Because product ops was run as a set of favours between teams, not as a system with a cadence, decision rights and a written output. |

**Root cause:** no operating system for product challenges: no single intake, no quantification standard, no transparent ranking with a compliance floor, no weekly forum that writes its decisions down.

**Countermeasures in this concept:**

- One intake board; themes, not tickets (→ fixes #3, #4)
- A published scoring model with a compliance floor and logged overrides (→ #2)
- Monday triage rule: *nothing leaves triage without an owner and a number* (→ #4, #5)
- Wednesday forum with written rationale; Friday digest (→ #5)

## 2. Applied: RCA-031, UK SSP underpaid across the April 2026 rule change

| # | Why? | Answer | Evidence |
|---|---|---|---|
| 1 | Why were 212 employees underpaid? | Three waiting days were applied after the rule abolishing them took effect. | Payroll lines for April/May cycles |
| 2 | Why were waiting days applied? | Their absence started before 6 April 2026, under the old rules. | 212/212 cases had a period of incapacity starting before 6 April |
| 3 | Why did the old rule follow the absence? | The engine evaluates rules at the start of the period. | Engine design doc; code path |
| 4 | Why was there no transitional case? | The spec described the new rule only. | Spec review |
| 5 | Why did the spec miss it? | Rule-change specs had no required "boundary cases" section. | Spec template |

**Hypotheses rejected along the way:** rate table not updated (config diff showed it was correct); duplicate absences from HRIS sync (0 duplicates in the affected set).

**Fix:** transitional rule for linked periods, retro correction in June payroll.
**Prevention (the real fix):** every statutory change now needs a boundary-case spec, reviewed at Tuesday's risk radar, and a boundary-date test pack runs on every rule change.
**Verified:** three parallel cycles with zero variances; all 212 corrected.

### Where the pattern repeats

The same root shape ("rule change specified without its boundary") appears in the sample data again:

- **RCA-040** (Ireland): service eligibility measured from EOR transfer date. The boundary is the employment transfer.
- **FB-1075** (UK P60s): the year-end validation pack still assumes the pre-April rule. The boundary is the tax year.

That's why the prevention action lives in the cadence (Tuesday risk radar → *every statutory change gets a boundary-case spec*), not in a single ticket.
