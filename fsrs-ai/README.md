# FSRS-AI Service

FSRS-AI la microservice FastAPI chuyen xu ly lich on tap (FSRS v6), optimizer, va thong ke human-readable cho he thong English Learning.

## 1) Tech stack

- FastAPI
- SQLAlchemy Async + PostgreSQL (schema `fsrs`)
- `fsrs[optimizer]` v6

## 2) Run local

```bash
cd fsrs-ai
cp .env.example .env
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Swagger:

- Local service: `http://localhost:8000/api-docs`
- Qua gateway: `http://localhost:3000/fsrs-ai/api-docs`

## 3) Environment variables

| Variable                          |                    Default | Description                                         |
| --------------------------------- | -------------------------: | --------------------------------------------------- |
| `DATABASE_URL`                    | `postgresql+asyncpg://...` | DB connection string                                |
| `PORT`                            |                     `8000` | Service port                                        |
| `ROOT_PATH`                       |                         `` | Use `/fsrs-ai` khi chay sau gateway                 |
| `FSRS_TRAIN_MIN_VALID_LOGS`       |                       `50` | Min valid logs de duoc optimize                     |
| `FSRS_TRAIN_MIN_DAYS_SINCE_LAST`  |                        `3` | Cooldown (ngay) giua 2 lan optimize accepted        |
| `FSRS_TRAIN_MIN_IMPROVEMENT_PCT`  |                     `0.02` | Muc cai thien toi thieu de accept candidate         |
| `FSRS_TRAIN_METRIC`               |                 `log_loss` | Metric gate (hien tai: log_loss)                    |
| `FSRS_RESCHEDULE_MAX_SHIFT_RATIO` |                      `0.3` | Gioi han due-date shift khi reschedule              |
| `FSRS_ASYNC_RESCHEDULE_ENABLED`   |                     `true` | Trigger reschedule background sau optimize accepted |

## 4) API overview

Tat ca endpoint ben duoi duoc mo ta chi tiet tren Swagger (`/api-docs`).

### 4.1 Review core

#### `GET /api/v1/fsrs/due`

Query:

- `user_id` (uuid, required)
- `limit` (1..200, optional)

Response:

```json
{ "wordIds": [101, 102], "total": 2 }
```

#### `POST /api/v1/fsrs/review`

Request:

```json
{
  "userId": "uuid",
  "wordId": 123,
  "isCorrect": true,
  "durationMs": 4200,
  "exerciseType": "DICTATION",
  "attempts": 2,
  "hadWrong": true
}
```

#### `POST /api/v1/fsrs/review/bulk`

Request:

```json
{
  "userId": "uuid",
  "items": [
    {
      "wordId": 123,
      "isCorrect": true,
      "durationMs": 4200,
      "exerciseType": "FLASHCARD",
      "attempts": 1,
      "hadWrong": false
    }
  ]
}
```

#### `POST /api/v1/fsrs/init-cards`

Query:

- `user_id` (uuid)
- `word_ids` (repeatable query param)

#### `GET /api/v1/fsrs/stats`

Query:

- `user_id` (uuid)

### 4.2 Optimizer

#### `POST /api/v1/fsrs/optimize`

Request:

```json
{ "userId": "uuid" }
```

Response co cac truong:

- `status`, `accepted`, `reason`
- `metricBaseline`, `metricCandidate`, `improvementPct`
- `modelVersion`, `sampleSize`

#### `POST /api/v1/fsrs/optimize/rollback`

Rollback ve ban accepted truoc do (hoac `targetVersion` cu the).

Request:

```json
{ "userId": "uuid", "targetVersion": 2 }
```

### 4.3 Helper

#### `POST /api/v1/fsrs/helper/reschedule`

Request:

```json
{ "userId": "uuid" }
```

Response:

```json
{ "status": "success", "cardsRescheduled": 120, "cardsCapped": 18 }
```

### 4.4 Reporting (human-readable)

Tat ca endpoint reporting tra ve 2 lop:

- `metrics`: du lieu cho FE ve chart
- `narrative`: 1-3 cau tieng Viet de user doc nhanh

#### `GET /api/v1/fsrs/insights?window=7d|30d|90d`

#### `GET /api/v1/fsrs/report/daily?from=YYYY-MM-DD&to=YYYY-MM-DD`

#### `GET /api/v1/fsrs/recommendations`

#### `GET /api/v1/fsrs/cards/risk?take=20`

Example format:

```json
{
  "metrics": { "memoryScore": 73, "retentionRate": 0.86, "dueTomorrow": 28 },
  "narrative": [
    "Kha nang ghi nho cua ban dang on dinh o muc kha.",
    "Ngay mai co 28 tu den han, nen on 2 phien ngan de tranh don bai."
  ]
}
```

## 5) Validation rules (important)

- `durationMs` bat buoc > 0.
- `exerciseType` chi nhan: `FLASHCARD`, `MULTI_CHOICE`, `LISTEN_FILL`, `DICTATION`.
- `attempts >= 1`.
- Cac endpoint co `user_id` query deu ho tro bo qua `user_id` neu request di qua gateway
  va co `x-user-id` header hop le.
- Neu vua co `user_id` vua co `x-user-id` ma khac nhau -> `403`.

Neu payload sai, API se tra `422`.

## 6) Migration

Da bo sung migration model version + config fields:

- `fsrs-ai/alembic/versions/202604041930_add_model_version_and_config_fields.py`

Can apply migration truoc khi deploy thay doi optimizer/versioning.

Lenh chuan:

```bash
alembic upgrade head
```

## 7) Related docs

- `fsrs-ai/PLAN.md`
- `fsrs-ai/SPEC_FSRS_V6_OPTIMIZATION.md`
- `.codex`
