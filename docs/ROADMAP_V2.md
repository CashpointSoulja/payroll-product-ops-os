# v2 roadmap

v1 proves the operating model with synthetic data in a static page. v2 makes it the system of record for a real payroll product org. Ordered by what unlocks the most leverage first.

## Now (first 30 days in the seat)

| Item | Why | Success measure |
|---|---|---|
| **Read-only ingestion** from the ticketing system, CRM notes and ops escalation channel into `feedback_signals` | Kill manual copy-paste; make counts real | ≥ 90% of payroll signals land automatically |
| **Theme assignment at triage** (one click to attach a signal to an existing theme or create one) | Themes, not tickets | Median time to triage ≤ 48h |
| **Warehouse-backed metrics** (definitions in [METRICS.md](METRICS.md)) feeding the Friday scorecard | Replace synthetic numbers with SQL | Scorecard auto-builds every Friday |
| **Compliance rubric** owned by Payroll Compliance (5 = statutory breach / late filing / money not moving; 1 = cosmetic) | Make the floor objective | Rubric signed off; 10-theme calibration passes |

## Next (60–90 days)

| Item | Why |
|---|---|
| **Deadline factor** in the scoring model (days to statutory deadline, decaying) | The most common override reason in v1 data; turn it into a rule |
| **Decision log with versioning**: every commit / decline / override is a record with author, date and rationale | Auditability; feeds the override-rate metric |
| **Issue tracker sync** (theme ↔ epic, status flows back) | Stops the board going stale |
| **Statutory change calendar**: every country's upcoming rule changes, tax year-ends and filing deadlines as first-class intake items | Tuesday risk radar runs from data, not memory |
| **Multi-launch tracker** with shared workstream owners and a capacity view | More than one launch at a time, without double-booking legal or FinOps |
| **Similarity suggestions at intake** (text similarity against open themes) | Faster deduplication; human confirms |

## Later

| Item | Why |
|---|---|
| **Scoring backtests** each quarter against realised harm (corrections, churn reasons, late filings) | Keep the model honest |
| **Money-movement risk view** across funding, reclaim, payouts and KYC holds | FinOps, FinCrime and TechOps see one picture with banking partners |
| **Partner scorecards** for in-country payroll partners (accuracy, SLA, escalation volume) | Turns partner management into data |
| **Permissions and audit trail** | Required before the board becomes a system of record |
| **Customer-facing status** for P0 themes (opt-in, per account) | CSMs stop chasing status by hand |

## Explicitly not planned

- Replacing the ticketing system, CRM or issue tracker.
- Automated priority changes without a human decision at the forum.
- Any change that lets volume alone outrank the compliance floor.
