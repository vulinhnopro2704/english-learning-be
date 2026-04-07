# Dashboard FSRS Integration Plan (FE + BE)

## 1) Goal
Tich hop day du bo API bao cao/thong ke FSRS vao Dashboard nguoi dung voi UI ro rang, de nguoi dung:
- Biet tinh trang tri nho hien tai
- Biet khoi luong bai sap toi
- Co goi y hanh dong cu the
- Uu tien on lai cac the rui ro cao

## 2) Scope
### In scope
- BE (`gateway` + `fsrs-ai`): dam bao dashboard APIs san sang, docs ro rang, contract on dinh cho FE goi truc tiep.
- FE (Dashboard Page): bo cuc moi + chart + recommendation + risk list.
- Contract docs: request/response, fallback behavior, loading/error states.

### Out of scope (phase sau)
- A/B test copywriting recommendation.
- Notification/push theo recommendation.
- Advanced personalization theo CEFR/course context.

## 3) Architecture decision
### Recommended path (updated)
- FE goi truc tiep `fsrs-ai` qua Gateway:
  - `/fsrs-ai/api/v1/fsrs/insights`
  - `/fsrs-ai/api/v1/fsrs/recommendations`
  - `/fsrs-ai/api/v1/fsrs/report/daily`
  - `/fsrs-ai/api/v1/fsrs/cards/risk`
- Gateway da auth JWT va route san nen khong can them tang trung gian neu chua can.
- `learn` facade chi dung khi can:
  - gop data tu nhieu service trong 1 endpoint
  - can API shape khac cho mobile/web legacy
  - can cache/tune retry tap trung o BE

## 4) Workstreams
## 4.1 BE workstream (gateway + fsrs-ai)
1. Xac nhan gateway auth/prefix cho `/fsrs-ai/*` (da co).
2. Hoan thien docs Swagger FSRS-AI cho dashboard endpoints.
3. Toi uu report APIs neu can (latency/pagination/range validation).
4. (Optional) Add learn-facade only when aggregator requirements appear.

## 4.2 FE workstream (Dashboard)
1. Redesign dashboard sections:
   - Header KPI cards (memory score, retention, due tomorrow)
   - Trend area (retention trend + workload)
   - Daily chart (reviews, accuracy, response time)
   - Recommendation panel (narrative text)
   - Risk cards table/list
2. Tao typed API client + React query hooks.
3. Add skeleton/loading/error/empty states.
4. Responsive layout mobile/desktop.

## 5) Milestones
### M1 - BE facade + contract (priority highest)
- Dashboard APIs FSRS-AI qua gateway chay on dinh.
- Swagger FSRS-AI docs day du.

### M2 - FE integration v1
- Dashboard dung du lieu that tu APIs moi.
- Co loading/error state day du.

### M3 - UX polish + observability
- Tune copy narrative, chart legends, action CTA.
- Add log/metric theo endpoint (latency, upstream errors).

## 6) Acceptance criteria
- FE Dashboard hien thi day du:
  - summary metrics
  - daily series
  - recommendations
  - risk list
- FE goi API qua gateway path `/fsrs-ai/*` va gui JWT hop le.
- FE khong can gui `user_id` thu cong (gateway forward `x-user-id`).
- Khi fsrs-ai fail, dashboard van render phan con lai + thong bao ro rang.
- Swagger docs co example request/response cho tat ca endpoint can dashboard.

## 7) Rollout plan
1. Ship FE integration goi truc tiep gateway `/fsrs-ai/*`.
2. Monitor error-rate/latency 48h.
3. Tune response copy/visual density theo feedback user.
4. Chi them `learn` facade neu can gom da nguon.

## 8) Risks and mitigation
- Risk: upstream fsrs-ai cham -> Mitigation: timeout + partial response.
- Risk: dashboard call nhieu endpoint -> Mitigation: FE query parallel + cache + batched refresh.
- Risk: FE chart mismatch units -> Mitigation: fix typed contract in shared DTO.

## 9) Implementation order
1. FE: dashboard data layer (goi `/fsrs-ai/*` qua gateway) + render
2. FSRS-AI: tune endpoint docs/perf neu can
3. Optional: `learn` facade neu phat sinh nhu cau aggregator
