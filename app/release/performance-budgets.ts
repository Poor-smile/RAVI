export const RELEASE_PERFORMANCE_BUDGETS = {
  startupInteractiveMs: 3_000,
  thousandFileShelfReadyMs: 15_000,
  virtualTreeResponseMs: 1_500,
  largeDocumentInputResponseMs: 200,
  imagePlaceholderReadyMs: 1_000,
  mermaidStableRenderMs: 15_000,
  maximumLongTaskMs: 200,
} as const;

export type ReleasePerformanceBudget =
  keyof typeof RELEASE_PERFORMANCE_BUDGETS;

export function withinReleaseBudget(
  metric: ReleasePerformanceBudget,
  durationMs: number,
) {
  return (
    Number.isFinite(durationMs) &&
    durationMs >= 0 &&
    durationMs <= RELEASE_PERFORMANCE_BUDGETS[metric]
  );
}
