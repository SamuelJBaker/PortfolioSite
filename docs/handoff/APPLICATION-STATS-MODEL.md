# Application statistics model (v1, 2026-11-13)

Purpose: decide which resume version to send, which postings to spend time on,
and when to stop waiting, using only data the referral system can collect.
Input to the tracking phase prompt; this document defines what to store and
what to compute, not how to build it.

## 1. What the data can and cannot support

- Positive responses are rare. At a 5 percent base rate, 100 applications give
  about 5 positives.
- Telling a 5 percent version from a 10 percent version at the usual
  significance level needs about 430 applications per version; 5 versus 15
  percent needs about 140 per version.
- So the model does not run significance tests. It keeps a posterior per
  option, acts on probabilities, and shrinks every small cell toward the
  overall rate. Expect directional answers, not proof.
- "Anything and everything" is stored, but only one comparison is treated as
  confirmatory: resume version. Every other cut is exploratory and is shown
  with its n and interval.

## 2. Records

### application (one row per submission)

Posting
- company, company_size_band, industry
- role_title, role_family (platform, ml, graphics, general swe, other),
  level (intern, new grad, junior, mid)
- location, work_mode (onsite, hybrid, remote)
- salary_min, salary_max, salary_period, benefits (free-text tags)
- ats (greenhouse, lever, workday, ashby, icims, taleo, smartrecruiters,
  company-built, email, other)
- source_channel (company site, linkedin, handshake, referral, career fair,
  recruiter inbound, other)
- posted_at (or first_seen_at), posting_age_days at submission
- applicant_count if the board shows it, requisition_id, posting_url

Submission
- applied_at (timestamp), referral (bool), cover_letter (none, generic,
  tailored)
- resume_version_id, assigned_by (random, manual), tailored (bool)
- fit (1 to 5, entered before submitting, never edited afterwards)
- effort_minutes
- key (the /r/<key> short link stamped into that PDF)

### resume_version

- id, created_at, content_hash (computed with the short link removed), notes
- factors: a small set of named switches, for example summary (on, off),
  project_order (lalto-first, ecs-first), length (1 page, 2 page),
  bullet_style (metric-first, task-first). A version is a combination of
  factor levels. Change one factor per new version.

### event (many per application, append-only)

- type: link_visit_human, link_visit_bot, rejection, recruiter_contact,
  assessment_invite (with auto: bool), phone_screen, interview, offer,
  withdrawn, followup_sent
- at (timestamp), note

## 3. Outcomes

- Primary, Y: a human-initiated advance (recruiter_contact, phone_screen,
  interview, or a non-automatic assessment_invite) within T = 30 days of
  applied_at.
- Resolved: Y = 1, or a rejection, or 30 days elapsed (counted as Y = 0,
  "ghosted"). Unresolved applications are excluded from every rate.
- Secondary: V = a human visit on the key within 14 days (more frequent than
  Y, so it moves first); I = any interview; O = offer.
- Time outcomes: days to first response of any kind, days to rejection.

## 4. Resume version: assignment and inference

Assignment is the only part that supports a causal reading, so it is done by
the system, not by choice.

- At most 3 live versions.
- When an application row is created, the system draws the version (Thompson
  sampling, below) within the role_family, and stamps the key into that PDF.
- Versions run concurrently. Sending version A in November and B in December
  confounds version with season and is not a comparison.
- If the resume is hand-edited for a posting, set tailored = true. Tailored
  rows are excluded from the version comparison and reported separately.

Posterior per version v, with k_v positives in n_v resolved, untailored rows:

    p_v ~ Beta(a0 + k_v, b0 + n_v - k_v),  a0 = 0.5, b0 = 9.5

(prior mean 5 percent, worth 10 applications; re-centre a0, b0 on the
observed overall rate once 50 rows are resolved, keeping a0 + b0 = 10).

Thompson sampling: draw one value from each live version's posterior, send
the version with the largest draw. Floor: any live version whose share of the
last 20 assignments is under 20 percent is assigned next.

Reported per version: n, k, posterior mean, 80 percent interval,
P(best among live versions) by Monte Carlo (20000 draws), and the same for V.

Decision rules
- Retire a version when P(best) < 0.10 and n_v >= 25.
- Promote a version to default when P(best) > 0.85 and n_v >= 25; then
  introduce a challenger that changes one factor.
- Example of the scale involved: 2 of 40 against 5 of 40 gives
  P(second is better) of about 0.88. That is enough to act on, not to claim.

Factor view: once 3 or more versions have existed, pool rows by factor level
(all versions with summary = on against off) with the same Beta model. This
is how a retired version still teaches something.

## 5. Segment rates (ATS, channel, role family, work mode, posting age, ...)

For each level s of each dimension, with overall rate p0:

    rate_s = (k_s + m * p0) / (n_s + m),  m = 10

plus an 80 percent Beta interval. Cells with n_s < 10 are shown greyed.
Posting age is bucketed: 0 to 3, 4 to 7, 8 to 14, 15 to 30, over 30 days.
Salary is bucketed by midpoint into terciles of the applications so far.

These are descriptive. Segments differ in many ways at once, so a low rate
for one ATS may be the companies that use it.

## 6. Joint model (only when the data allows)

Fit only when resolved n >= 150 and positives >= 15, as a local script:

    logit P(Y_i = 1) = alpha + b_version[i] + u_ats[i] + u_family[i]
                       + u_channel[i] + c1 * log(1 + posting_age_i)
                       + c2 * referral_i + c3 * fit_i + c4 * remote_i

with partial pooling on the u terms and weakly informative priors
(Normal(0, 1) on standardized coefficients). Report coefficients as odds
ratios with intervals. Below the threshold the script refuses to fit and says
why. Rule of thumb enforced: no more parameters than positives / 10 outside
the pooled terms.

## 7. Timing

- Kaplan-Meier curve of days to first response, overall and per ATS, with
  unresolved rows right-censored.
- From it: median response time, and the day by which 90 percent of the
  responses that ever arrive have arrived. Use that day to replace T = 30
  once 20 responses exist, and as the follow-up trigger.
- Hour and weekday of applied_at are stored but not modelled in v1.

## 8. Throughput and priority

Weekly: applications sent, effort hours, resolved count, positives, human
visits, pipeline by stage.

Yield per hour for a segment s:

    yield_s = rate_s / mean_effort_hours_s

Priority score for a new posting, before applying (naive combination of
shrunk rates, replaced by the joint model's prediction when section 6 fits):

    odds_i = odds(p0) * product over dimensions d of
             [ odds(rate_{d, level_i}) / odds(p0) ] ^ 0.5
    score_i = p_i / expected_effort_hours_i

The 0.5 exponent damps double counting between correlated dimensions.
The score ranks a backlog; it is not a probability to quote.

## 9. Guards

- Every number is shown with n. No rate is shown for unresolved rows.
- fit is entered before the outcome and is immutable, so it cannot drift
  toward hindsight.
- Bot and scanner visits never count toward V.
- Automatic assessment invites never count toward Y.
- Referral applications are excluded from the version comparison (the
  referral dominates) and reported as their own segment.
- A change to the definition of Y or T is logged with a date; rates are not
  compared across a definition change.

## 10. Admin views this implies

1. Versions: table from section 4 with assign-next indicator.
2. Segments: one table per dimension from section 5, sortable by yield.
3. Funnel: applied, human visit, response, interview, offer, with counts and
   conversion intervals.
4. Timing: the response curve and the two derived days.
5. Backlog: postings saved but not applied to, ranked by score.
6. Week: throughput figures against the previous four weeks.
