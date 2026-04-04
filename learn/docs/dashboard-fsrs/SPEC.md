# Dashboard FSRS Integration Spec (FE + BE)

## 1) API contract strategy
Frontend goi truc tiep FSRS-AI thong qua Gateway path `/fsrs-ai/*` (co JWT).
Khong tao `learn` facade neu chua co nhu cau aggregator da nguon.

## 2) BE spec (Gateway + FSRS-AI direct)
## 2.1 Endpoint set for dashboard
Frontend se goi truc tiep:
- `GET /fsrs-ai/api/v1/fsrs/insights?window=7d|30d|90d`
- `GET /fsrs-ai/api/v1/fsrs/recommendations`
- `GET /fsrs-ai/api/v1/fsrs/report/daily?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /fsrs-ai/api/v1/fsrs/cards/risk?take=20`

Luu y:
- Gateway dang yeu cau JWT cho `/fsrs-ai/*` (tru docs).
- FSRS-AI co the resolve user tu `x-user-id` (gateway forward tu JWT), nen FE khong can gui `user_id`.
- Backward-compatible: van cho phep gui `user_id` query neu can.

Response:
```json
{
  "data": {
    "metrics": {
      "memoryScore": 73,
      "retentionRate": 0.86,
      "workloadForecast": { "next7dDue": 120, "dueTomorrow": 28 },
      "masteryDistribution": { "new": 10, "learning": 22, "review": 180, "relearning": 8 },
      "trend": { "vsPreviousWindow": 0.04 },
      "overdueGt3d": 42,
      "speedDeltaPct": 0.18,
      "accuracyDeltaPct": -0.04,
      "suggestedDailyLimit": 35
    },
    "narrative": [
      "Kha nang ghi nho cua ban dang on dinh o muc kha.",
      "Ngay mai co 28 tu den han, nen chia nho phien on."
    ]
  },
  "meta": { "window": "30d", "partial": false, "warnings": [] }
}
```

Fallback behavior:
- Neu `recommendations` fail nhung `insights` ok -> tra partial true + warning.
- Neu ca 2 fail -> 502 + message ro rang.

## 2.2 Endpoint: GET /fsrs-ai/api/v1/fsrs/report/daily
Query:
- `from` (YYYY-MM-DD, required)
- `to` (YYYY-MM-DD, required)

Response:
```json
{
  "data": {
    "days": [
      {
        "date": "2026-04-01",
        "reviews": 42,
        "accuracy": 0.81,
        "avgResponseMs": 5300,
        "dueCreated": 35,
        "dueCompleted": 30
      }
    ],
    "narrative": ["Do chinh xac trung binh 81%."]
  },
  "meta": { "partial": false, "warnings": [] }
}
```

## 2.3 Endpoint: GET /fsrs-ai/api/v1/fsrs/cards/risk
Query:
- `take` (default 20, max 100)

Response:
```json
{
  "data": {
    "items": [
      { "wordId": 123, "riskScore": 0.92, "retrievability": 0.31, "daysOverdue": 4 }
    ],
    "narrative": ["Cac the rui ro cao can uu tien on tap."]
  },
  "meta": { "partial": false, "warnings": [] }
}
```

## 2.4 Error model
Hien tai follow error envelope tu FSRS-AI/gateway. FE can map:
- 401/403: auth issue
- 422: query/payload invalid
- 5xx: upstream/system errors

## 2.5 Timeout/retry policy (FE side)
- Timeout moi request: 2s-3s
- Retry 1 lan voi exponential backoff nhe cho GET endpoints
- Neu request nao fail, render partial sections voi warning banner

## 3) FE spec (Dashboard Page)
## 3.1 Data fetching
Hooks:
- `useFsrsInsights(window)` -> `/fsrs-ai/api/v1/fsrs/insights`
- `useFsrsRecommendations()` -> `/fsrs-ai/api/v1/fsrs/recommendations`
- `useFsrsDaily(from, to)` -> `/fsrs-ai/api/v1/fsrs/report/daily`
- `useFsrsRisk(take)` -> `/fsrs-ai/api/v1/fsrs/cards/risk`

Refetch strategy:
- `staleTime`: 60s cho summary/risk
- `staleTime`: 5m cho daily
- Manual refresh button

## 3.2 Dashboard layout
Section A - Hero KPI cards:
- Memory Score
- Retention Rate
- Due Tomorrow
- Overdue >3d

Section B - Trend + Workload:
- Trend chip (`+/- vs previous window`)
- Workload forecast 7 ngay

Section C - Daily chart:
- Line/area: reviews + accuracy + avgResponseMs
- Toggle metrics on/off

Section D - Recommendations:
- 1-3 narrative lines
- CTA: "On ngay" -> route sang trang practice

Section E - High risk cards:
- top list (wordId + risk score + overdue)
- button "Xem them"

## 3.3 FE state behavior
- Loading: skeleton theo tung section
- Partial data: render duoc section nao thi render, hien warning banner
- Empty data: hien empty-state copy
- Error all: hien retry + fallback message

## 3.4 FE TypeScript interfaces
```ts
export interface FsrsSummaryData {
  metrics: {
    memoryScore: number;
    retentionRate: number;
    workloadForecast: { next7dDue: number; dueTomorrow: number };
    masteryDistribution: { new: number; learning: number; review: number; relearning: number };
    trend: { vsPreviousWindow: number };
    overdueGt3d: number;
    speedDeltaPct: number;
    accuracyDeltaPct: number;
    suggestedDailyLimit: number;
  };
  narrative: string[];
}
```

## 4) Security and privacy
- FE khong can gui `user_id` khi request di qua gateway (gateway forward `x-user-id`).
- JWT duoc verify o gateway truoc khi vao FSRS-AI.
- Khong log payload nhay cam (token, user personal data).

## 5) Observability
Metrics can add:
- `dashboard_fsrs_upstream_latency_ms`
- `dashboard_fsrs_partial_response_count`
- `dashboard_fsrs_error_count`

## 6) Test plan
## 6.1 FE tests
- Unit: transform and render each section
- Integration: partial/error/loading states
- E2E: dashboard open + refresh + CTA to practice

## 6.2 Optional BE tests (neu them facade)
- Unit: map response + partial fallback
- Integration: controller -> service -> mocked fsrs upstream

## 7) Definition of done
- FSRS-AI APIs can dashboard co docs day du tren swagger
- FE dashboard render full 5 sections
- Partial/failure paths da test
- Team co 1 tai lieu contract duy nhat (file nay)
