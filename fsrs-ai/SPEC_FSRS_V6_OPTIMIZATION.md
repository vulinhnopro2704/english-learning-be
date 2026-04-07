# FSRS-AI Feature Spec - v6 Optimization

## 1) Problem statement

Current FSRS flow works, but model optimization can be noisy because review quality is inconsistent and model updates are not guarded by a strict acceptance policy. We also lack human-readable analytics endpoints for product features.

## 2) Functional requirements

## 2.1 Review data quality

- Require real `durationMs` in all review submissions.
- Extend review item payload:
  - `attempts`: integer, min 1, default 1
  - `exerciseType`: normalized uppercase enum
- Persist event metadata inside `review_log.log_data.event`.

### Request contract (single review)

```json
{
  "userId": "uuid",
  "wordId": 123,
  "isCorrect": true,
  "durationMs": 4200,
  "exerciseType": "DICTATION",
  "attempts": 2
}
```

### Request contract (bulk review item)

```json
{
  "wordId": 123,
  "isCorrect": true,
  "durationMs": 4200,
  "exerciseType": "DICTATION",
  "attempts": 2
}
```

## 2.2 Training policy and model lifecycle

- Train only when:
  - `valid_logs >= FSRS_TRAIN_MIN_VALID_LOGS` (default 50)
  - days since last accepted train >= `FSRS_TRAIN_MIN_DAYS_SINCE_LAST` (default 3)
- Compute metric for baseline and candidate.
- Accept candidate only if:
  - `(baseline - candidate) / baseline >= FSRS_TRAIN_MIN_IMPROVEMENT_PCT`
- Track model versions and metadata.
- Support rollback to previous accepted version.

## 2.3 Safe reschedule

- Run reschedule async after accepted model.
- Batch by users/cards.
- Cap interval shift:
  - absolute change ratio <= `FSRS_RESCHEDULE_MAX_SHIFT_RATIO` (default 0.3)

## 2.4 Reporting APIs

All reporting endpoints must return:

- `metrics`: machine-readable object for charts
- `narrative`: 1-3 short Vietnamese sentences for user

### 2.4.1 GET /api/v1/fsrs/insights

Query:

- `user_id` (uuid, required)
- `window` (enum: `7d|30d|90d`, default `30d`)

Response:

```json
{
  "metrics": {
    "memoryScore": 73,
    "retentionRate": 0.86,
    "workloadForecast": { "next7dDue": 120, "dueTomorrow": 28 },
    "masteryDistribution": {
      "new": 10,
      "learning": 22,
      "review": 180,
      "relearning": 8
    },
    "trend": { "vsPreviousWindow": 0.04 }
  },
  "narrative": [
    "Kha nang ghi nho cua ban dang on dinh o muc kha.",
    "Ngay mai co 28 tu den han, nen on 2 phien ngan de tranh don bai."
  ]
}
```

### 2.4.2 GET /api/v1/fsrs/report/daily

Query:

- `user_id` (uuid, required)
- `from` (date, required)
- `to` (date, required)

Response:

```json
{
  "metrics": {
    "days": [
      {
        "date": "2026-04-01",
        "reviews": 42,
        "accuracy": 0.81,
        "avgResponseMs": 5300,
        "dueCreated": 35,
        "dueCompleted": 30
      }
    ]
  },
  "narrative": [
    "Trong 7 ngay qua, do chinh xac trung binh dat 81%.",
    "Khoi luong bai dang duoc giai quyet deu."
  ]
}
```

### 2.4.3 GET /api/v1/fsrs/recommendations

Query:

- `user_id` (uuid, required)

Response:

```json
{
  "metrics": {
    "overdueGt3d": 42,
    "speedDeltaPct": 0.18,
    "accuracyDeltaPct": -0.04,
    "suggestedDailyLimit": 35
  },
  "narrative": [
    "Ban dang co 42 tu qua han hon 3 ngay.",
    "Toc do hom nay tang 18% nhung do chinh xac giam 4%, nen giam so cau kho."
  ]
}
```

### 2.4.4 GET /api/v1/fsrs/cards/risk

Query:

- `user_id` (uuid, required)
- `take` (int, default 20, max 100)

Response:

```json
{
  "metrics": {
    "items": [
      {
        "wordId": 123,
        "riskScore": 0.92,
        "retrievability": 0.31,
        "daysOverdue": 4
      }
    ]
  },
  "narrative": ["Danh sach gom cac the co rui ro quen cao nhat de uu tien on tap."]
}
```

## 3) Non-functional requirements

- Backward compatibility for existing endpoints.
- Deterministic response keys (camelCase aliases).
- P95 latency target:
  - insights/report/recommendations/risk <= 300ms for normal load.
- Full request validation and explicit 422 details.

## 4) Data model changes (proposed)

## 4.1 Existing tables

- `review_log.logData.event` extend with:
  - `attempts`, `exerciseTypeNormalized`, `durationMsValid`.

## 4.2 New table: fsrs_model_version (proposed)

- `id` uuid pk
- `userId` uuid index
- `version` int
- `weights` jsonb
- `requestRetention` float
- `sampleSize` int
- `metricType` text
- `metricBaseline` float
- `metricCandidate` float
- `improvementPct` float
- `status` text (`accepted|rejected|rolled_back`)
- `trainedAt` timestamptz
- `createdAt` timestamptz

## 4.3 FSRS config extensions (optional)

- `lastTrainedAt` timestamptz
- `currentModelVersion` int

## 5) Env configuration (proposed)

- `FSRS_TRAIN_MIN_VALID_LOGS=50`
- `FSRS_TRAIN_MIN_DAYS_SINCE_LAST=3`
- `FSRS_TRAIN_MIN_IMPROVEMENT_PCT=0.02`
- `FSRS_TRAIN_METRIC=log_loss`
- `FSRS_RESCHEDULE_MAX_SHIFT_RATIO=0.3`
- `FSRS_ASYNC_RESCHEDULE_ENABLED=true`

## 6) Error handling contract

- `422` for invalid payload (`durationMs <= 0`, bad enum, bad dates).
- `409` when train request rejected by policy.
- `202` for accepted async operations (optimize+reschedule queued).
- `200` for sync read/reporting endpoints.

## 7) Test plan

- Unit:
  - duration validation
  - enum normalization
  - train eligibility logic
  - acceptance gate threshold logic
  - due-date cap logic
- Integration:
  - optimize -> version created -> reschedule queued
  - rollback restores prior accepted model
  - insights/report endpoints aggregate correct window data
- Contract:
  - response must include `metrics` and `narrative`.

## 8) Open decisions

- Metric implementation choice:
  - start with log-loss only
  - add calibration error in next phase
- Async mechanism:
  - in-process background task first
  - move to queue worker later if traffic increases

## 9) Change log (update during implementation)

- 2026-04-04: initial feature spec created.
- 2026-04-04: implemented core backend changes:
  - strict review payload validation (`durationMs`, enum normalization, attempts, metadata)
  - optimizer policy gates + metric acceptance + model versioning
  - rollback endpoint
  - async safe reschedule with shift cap
  - reporting endpoints (`insights`, `report/daily`, `recommendations`, `cards/risk`)
