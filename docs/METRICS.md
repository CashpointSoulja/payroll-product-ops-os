# Metrics

How the operating system itself is measured, and how each metric would be computed against a warehouse. Figures in the app are synthetic; the definitions are the real proposal.

## North star

**Sick-pay and statutory payroll lines paid correctly first time** (% of statutory lines with no correction in the following two cycles).

It is the closest single number to what employees and customers feel, and every module pushes it: intake finds the defects, prioritisation ranks them with a compliance floor, GTM ships fixes safely, RCA stops repeats.

## Input metrics (reviewed weekly, Friday digest)

| Metric | Definition | Target | Why it matters |
|---|---|---|---|
| Median time to triage | Hours from first signal to theme with owner + quantification | ≤ 48h | Slow triage is how compliance issues hide |
| Themes fully quantified | % of open themes with accounts > 0 and ARR exposure > 0 | 100% | No number, no priority |
| Open P0s | Count of open themes in P0 (including compliance floor) | Trend to 0 within 2 sprints of each | P0 means "fix now"; a standing P0 list is a process failure |
| Override rate | % of forum decisions that overrode the model band | 5–15% | Too low = rubber-stamping; too high = model is wrong |
| Launch readiness (per wave) | Weighted workstream status per country | 100% at T-7 | Leading indicator for slips |
| Gate pass rate at T-7 | % of country gates passed at the go / no-go | 100% | A fail is a no-go by definition |
| RCAs verified within 30 days of fix | % verified (metric recovered), not just shipped | ≥ 80% | "Fixed" ≠ fixed |
| Repeat incidents | RCAs whose root cause matches a previously verified RCA | 0 | Tests whether prevention actions stuck |

## Outcome metrics (monthly business review)

| Metric | Definition | Target |
|---|---|---|
| Payroll corrections per 1,000 payslips | Off-cycle corrections caused by calculation or data defects | ≤ 2.0 |
| Funding auto-match rate | % of payroll pay-ins matched to invoice without manual FinOps work | ≥ 99% |
| Statutory late filings | Filings submitted after the statutory deadline due to product causes | 0 |
| Contact rate per 100 payslips | Payroll-related support contacts | Trend down |
| ARR on accounts with an open P0 | Sum of ARR for customers exposed to an open P0 theme | Trend down |

## Guardrails

- **Don't trade accuracy for speed:** time to triage may not improve by dropping quantification (watch "themes fully quantified").
- **Don't game readiness:** gates are scored separately; readiness % never overrides a failed gate.
- **Money movement:** no launch may reduce funding auto-match rate or increase payout returns.

## SQL definitions (illustrative)

Assumes three warehouse tables: `feedback_signals` (one row per raw ticket/note), `feedback_themes`, and `payroll_lines`.

**Median time to triage**

```sql
select
  date_trunc('week', t.triaged_at)                                        as week,
  percentile_cont(0.5) within group (
    order by datediff('hour', s.first_signal_at, t.triaged_at))           as median_hours_to_triage
from feedback_themes t
join (
  select theme_id, min(created_at) as first_signal_at
  from feedback_signals
  group by 1
) s on s.theme_id = t.theme_id
where t.triaged_at is not null
group by 1
order by 1 desc;
```

**ARR exposure per theme** (distinct accounts, so one customer filing 40 tickets counts once)

```sql
select
  t.theme_id,
  count(distinct s.account_id)                               as accounts_affected,
  sum(distinct_acct.arr_usd) + coalesce(max(p.pipeline_usd), 0) as arr_exposure_usd
from feedback_themes t
join feedback_signals s on s.theme_id = t.theme_id
join (select account_id, arr_usd from accounts) distinct_acct
  on distinct_acct.account_id = s.account_id
left join (
  select theme_id, sum(amount_usd) as pipeline_usd
  from opportunities
  where stage not in ('Closed Won', 'Closed Lost') and blocker_theme_id is not null
  group by 1
) p on p.theme_id = t.theme_id
group by 1;
```

> Note: `sum(distinct ...)` is only safe when ARR values are unique per account; in production use a de-duplicated CTE of accounts per theme first.

**Statutory lines paid correctly first time (north star)**

```sql
select
  l.country,
  date_trunc('month', l.pay_date)                                    as month,
  1 - count_if(c.line_id is not null) / count(*)::float              as first_time_right
from payroll_lines l
left join payroll_corrections c
  on c.original_line_id = l.line_id
 and c.created_at <= dateadd('day', 62, l.pay_date)   -- next two monthly cycles
where l.line_type in ('statutory_sick_pay', 'statutory_leave')
group by 1, 2;
```

**Funding auto-match rate**

```sql
select
  date_trunc('week', received_at)                                   as week,
  count_if(match_method = 'auto') / count(*)::float                 as auto_match_rate
from payroll_pay_ins
where received_at >= dateadd('week', -12, current_date)
group by 1;
```

## Scoring model health

Reviewed quarterly:

1. **Backtest:** rank last quarter's themes with the current weights and compare with what actually caused customer harm (corrections, churn reasons, late filings). Adjust weights if the model would have missed something.
2. **Override audit:** cluster override reasons. FB-1075's "hard statutory deadline" override is the first candidate for a model change: a deadline factor.
3. **Calibration of compliance scores:** spot-check 10 themes against the Payroll Compliance rubric.
