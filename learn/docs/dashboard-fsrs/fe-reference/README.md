# FE Reference (Dashboard FSRS)

Folder nay cung cap ma mau de tich hop vao repo frontend (React/Next).

## Files
- `types.ts`: TypeScript interfaces theo contract FSRS APIs
- `api.ts`: HTTP client wrappers den `/fsrs-ai/*` qua gateway
- `hooks.ts`: React Query hooks + combined dashboard hook
- `DashboardFsrsPanel.tsx`: component skeleton de render dashboard sections

## Notes
- Mac dinh su dung cookie/JWT cua gateway (`credentials: include`).
- Khong can gui `user_id` thu cong neu request di qua gateway.
- Can cai `@tanstack/react-query` trong repo FE.

## Suggested FE wiring
1. Dat cac file vao `src/features/dashboard/fsrs/`
2. Boc app bang `QueryClientProvider`
3. Goi component:

```tsx
<DashboardFsrsPanel
  window="30d"
  from="2026-04-01"
  to="2026-04-30"
/>
```
