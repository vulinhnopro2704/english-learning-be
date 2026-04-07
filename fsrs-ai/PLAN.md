# FSRS-AI Implementation Plan (v6 Optimization)

## 1) Scope

- Standardize review data quality before training.
- Add stable training policy + model versioning + rollback.
- Make reschedule safer and async.
- Add human-readable analytics APIs:
  - `/insights`
  - `/report/daily`
  - `/recommendations`
  - `/cards/risk`

## 2) Goals and non-goals

### Goals

- Better data quality for FSRS v6 optimizer.
- Prevent bad model updates from harming schedule quality.
- Expose clear KPIs + narrative text for end-users.
- Keep backward compatibility for current `learn` flow.

### Non-goals

- No change to auth model in this phase.
- No UI implementation in this repo.
- No sibling-dispersal/easy-days advanced planner yet.

## 3) Implementation phases

### Phase A - Data quality hardening

1. Enforce `duration_ms > 0` in FSRS-AI schema/service.
2. Normalize `exercise_type` to uppercase enum:
   - `FLASHCARD`, `MULTI_CHOICE`, `LISTEN_FILL`, `DICTATION`.
3. Extend review payload/log metadata:
   - `attempts` (int >= 1)
   - `had_wrong` (bool)
4. Store normalized event metadata in `review_log.log_data.event`.
5. Add safe fallback policy:
   - if duration invalid -> reject with 422 (preferred)
   - optional future flag for temporary compatibility mode.

### Phase B - Training policy + model lifecycle

1. Add train eligibility policy (env-driven):
   - `FSRS_TRAIN_MIN_VALID_LOGS=50`
   - `FSRS_TRAIN_MIN_DAYS_SINCE_LAST=3`
2. Add evaluation gate:
   - compare candidate vs baseline by metric (log-loss or calibration error)
   - accept only when improved at least threshold
   - `FSRS_TRAIN_MIN_IMPROVEMENT_PCT=0.02` (2%) default
3. Add model version history:
   - `model_version`, `trained_at`, `sample_size`, `metric_baseline`, `metric_candidate`, `accepted`.
4. Add rollback endpoint:
   - revert to previous accepted model version quickly.

### Phase C - Safe reschedule

1. Trigger reschedule async after accepted optimization.
2. Reschedule in user batches to avoid latency spikes.
3. Cap due-date shift per run:
   - max shift ratio default `30%` (`FSRS_RESCHEDULE_MAX_SHIFT_RATIO=0.3`).
4. Persist audit summary:
   - total cards processed, skipped, capped, failed.

### Phase D - Reporting APIs

1. Implement `GET /api/v1/fsrs/insights`.
2. Implement `GET /api/v1/fsrs/report/daily`.
3. Implement `GET /api/v1/fsrs/recommendations`.
4. Implement `GET /api/v1/fsrs/cards/risk`.
5. All responses include:
   - `metrics` for charts
   - `narrative` (1-3 short Vietnamese sentences)

## 4) Deliverables checklist

- [x] Updated DB models + migration(s).
- [x] Updated schemas (`requests/responses`) with strict validation.
- [x] Updated review service to capture metadata and quality checks.
- [x] Updated optimizer service with policy gate and versioning.
- [x] Async reschedule worker/service path.
- [x] New reporting service + router endpoints.
- [ ] Tests: unit + API contract.
- [x] Docs updated: `.codex`, `PLAN.md`, feature spec.

## 5) Acceptance criteria

### Data quality

- `review` and `review/bulk` reject missing/invalid `duration_ms`.
- `exercise_type` is always stored normalized uppercase.
- `attempts` and `had_wrong` are persisted in `log_data.event`.

### Training quality

- Optimizer cannot run unless policy conditions pass.
- Candidate weights are not accepted when metric gain < threshold.
- Previous accepted model can be restored by rollback API.

### Reschedule safety

- Reschedule does not block request path.
- Due-date movement is capped by configured ratio.
- Audit fields visible in logs/response.

### Reporting APIs

- Insights/report/recommendations/risk endpoints return stable schema.
- Response contains both `metrics` and `narrative`.

## 6) Risks and mitigations

- Risk: stricter validation may break old clients.
  - Mitigation: release note + temporary compatibility flag if needed.
- Risk: metric gate rejects too often with small data.
  - Mitigation: tune threshold by env and include reason in response.
- Risk: async reschedule backlog growth.
  - Mitigation: queue limits + retry budget + dead-letter logging.

## 7) Suggested execution order

1. Phase A (data quality) first.
2. Phase B (train policy/versioning).
3. Phase C (async safe reschedule).
4. Phase D (reporting APIs).

## 8) Working mode for next iterations

- During implementation, append changes to:
  - `fsrs-ai/SPEC_FSRS_V6_OPTIMIZATION.md` (contract-level updates)
  - this file (status + done checklist)
- Rule: no schema/API change without updating spec in same PR.

## 9) Implementation status (2026-04-04)

- Done:
  - Added strict review contract (`durationMs > 0`, normalized `exerciseType`, `attempts`).
  - Added optimizer policy gates via env config.
  - Added metric-based acceptance (log-loss) and model version table.
  - Added rollback endpoint.
  - Added async reschedule trigger after accepted optimize and safe due shift cap.
  - Added reporting APIs: insights, report/daily, recommendations, cards/risk.
- Remaining:
  - Add automated tests for new policy/reporting behavior.
  - Run migration in deployed environments and verify data backfill assumptions.
