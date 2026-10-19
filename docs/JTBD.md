# Jobs to be done

Format: **When** [situation], **I want to** [motivation], **so I can** [outcome]. Each job maps to the module that serves it.

## Primary: Staff Product Operations Manager, Payroll

| # | Job | Module |
|---|---|---|
| 1 | **When** signals about the same problem arrive through support, CSMs, ops and sales, **I want to** collapse them into one theme with a count per source, **so I can** argue from the size of the problem, not the loudness of the channel. | Intake |
| 2 | **When** a theme is logged, **I want to** attach accounts affected, ARR exposure and compliance risk before it can leave triage, **so I can** compare unlike problems on one scale. | Intake |
| 3 | **When** leadership asks "why is this above that?", **I want to** show each factor's contribution and the arithmetic, **so I can** win the argument with the model, or change the model in the open. | Intake (score breakdown) |
| 4 | **When** a statutory deadline makes a theme more urgent than its score, **I want to** override the band with a written reason, **so I can** act now and still improve the model later. | Intake (override) |
| 5 | **When** a payroll feature launches in several countries, **I want to** see readiness per country × workstream with owners and dates, **so I can** spot the one blocked cell that would stall a whole wave. | GTM |
| 6 | **When** we are a week from GA, **I want to** run explicit go / no-go gates with evidence, **so I can** make a defensible launch call and stagger countries if one isn't ready. | GTM (gates) |
| 7 | **When** something breaks in production, **I want to** record competing hypotheses and close each with evidence, **so I can** fix the real cause and show the team how we got there. | RCA |
| 8 | **When** a fix ships, **I want to** keep the RCA open until the metric recovers, **so I can** stop "fixed" problems coming back. | RCA (verification) |
| 9 | **When** the week starts, **I want to** have the agenda for every forum built from live data, **so I can** spend meetings on decisions, not status. | Cadence |
| 10 | **When** the week ends, **I want to** publish one digest of decisions, launches, risks and metrics, **so I can** keep everyone aligned without extra meetings. | Cadence (scorecard, digest) |

## Secondary jobs

| Who | Job |
|---|---|
| **Payroll PM** | When I plan a sprint, I want a ranked, evidenced list with links to RCAs and launch scope, so I can commit without re-litigating priorities. |
| **Head of Product, Payroll** | When I chair the forum, I want the top themes with score, ARR and accounts on one page, so I can decide in the room and know the compliance floor can't be out-voted. |
| **Payroll Compliance** | When a law changes, I want it to enter the same intake as everything else with a deadline, so I can see it ranked instead of chasing it by email. |
| **FinOps / Treasury** | When funding, reclaim or payout flows change in a launch, I want a workstream and a gate for money movement, so I can block a launch that won't reconcile. |
| **FinCrime** | When a control (e.g. KYC refresh) creates friction, I want the friction treated as a product problem while the control stays intact, so I can keep the obligation without losing customers. |
| **Support lead** | When my team sees a spike, I want proof it was counted and a date for enablement, so I can tell agents what to say and when the fix lands. |
| **CSM** | When a customer escalates, I want to see the theme's status and decision log, so I can give a straight answer at renewal. |

## Anti-jobs (things this deliberately does not do)

- Replace the ticketing system, CRM or issue tracker. It sits above them.
- Let any single channel set priority by volume alone.
- Hide disagreements: overrides and rejected hypotheses stay visible.
