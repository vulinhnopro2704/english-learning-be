# FE Integration Code (Copy to Frontend Repo)

Duoi day la ma mau de paste vao repo FE (React/Next). Khong dat truc tiep vao `learn/` vi se anh huong TS build backend.

## 1) `types.ts`
```ts
export type FsrsWindow = '7d' | '30d' | '90d';

export interface FsrsInsightsResponse {
  metrics: {
    memoryScore: number;
    retentionRate: number;
    workloadForecast: { next7dDue: number; dueTomorrow: number };
    masteryDistribution: { new: number; learning: number; review: number; relearning: number };
    trend: { vsPreviousWindow: number };
  };
  narrative: string[];
}

export interface FsrsDailyReportPoint {
  date: string;
  reviews: number;
  accuracy: number;
  avgResponseMs: number;
  dueCreated: number;
  dueCompleted: number;
}

export interface FsrsDailyReportResponse {
  metrics: { days: FsrsDailyReportPoint[] };
  narrative: string[];
}

export interface FsrsRecommendationsResponse {
  metrics: {
    overdueGt3d: number;
    speedDeltaPct: number;
    accuracyDeltaPct: number;
    suggestedDailyLimit: number;
  };
  narrative: string[];
}

export interface FsrsRiskItem {
  wordId: number;
  riskScore: number;
  retrievability: number;
  daysOverdue: number;
}

export interface FsrsRiskResponse {
  metrics: { items: FsrsRiskItem[] };
  narrative: string[];
}
```

## 2) `api.ts`
```ts
import type {
  FsrsDailyReportResponse,
  FsrsInsightsResponse,
  FsrsRecommendationsResponse,
  FsrsRiskResponse,
  FsrsWindow,
} from './types';

const DEFAULT_TIMEOUT_MS = 3000;

async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const getFsrsInsights = (window: FsrsWindow = '30d') =>
  fetchJson<FsrsInsightsResponse>(`/fsrs-ai/api/v1/fsrs/insights?window=${window}`);

export const getFsrsRecommendations = () =>
  fetchJson<FsrsRecommendationsResponse>('/fsrs-ai/api/v1/fsrs/recommendations');

export const getFsrsDaily = (from: string, to: string) => {
  const params = new URLSearchParams({ from, to });
  return fetchJson<FsrsDailyReportResponse>(
    `/fsrs-ai/api/v1/fsrs/report/daily?${params.toString()}`,
  );
};

export const getFsrsRisk = (take = 20) =>
  fetchJson<FsrsRiskResponse>(`/fsrs-ai/api/v1/fsrs/cards/risk?take=${take}`);
```

## 3) `hooks.ts`
```ts
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  getFsrsDaily,
  getFsrsInsights,
  getFsrsRecommendations,
  getFsrsRisk,
} from './api';
import type { FsrsWindow } from './types';

export function useFsrsDashboard(window: FsrsWindow, from: string, to: string) {
  const results = useQueries({
    queries: [
      { queryKey: ['fsrs', 'insights', window], queryFn: () => getFsrsInsights(window), staleTime: 60_000 },
      { queryKey: ['fsrs', 'recommendations'], queryFn: getFsrsRecommendations, staleTime: 60_000 },
      {
        queryKey: ['fsrs', 'daily', from, to],
        queryFn: () => getFsrsDaily(from, to),
        staleTime: 5 * 60_000,
        enabled: Boolean(from && to),
      },
      { queryKey: ['fsrs', 'risk', 20], queryFn: () => getFsrsRisk(20), staleTime: 60_000 },
    ],
  });

  const [insights, recommendations, daily, risk] = results;

  const warnings = useMemo(() => {
    const items: string[] = [];
    if (insights.isError) items.push('Khong tai duoc chi so tong quan.');
    if (recommendations.isError) items.push('Khong tai duoc goi y hoc tap.');
    if (daily.isError) items.push('Khong tai duoc bao cao theo ngay.');
    if (risk.isError) items.push('Khong tai duoc danh sach the rui ro.');
    return items;
  }, [insights.isError, recommendations.isError, daily.isError, risk.isError]);

  return {
    insights,
    recommendations,
    daily,
    risk,
    warnings,
    isLoadingAll: results.every((item) => item.isLoading),
  };
}
```
