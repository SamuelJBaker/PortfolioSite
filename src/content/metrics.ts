export type Metric = { label: string; value: string; detail: string };

export const metrics: Metric[] = [
  { label: "ECS add/remove", value: "8.5x faster", detail: "100k entities: 99.8 ms to 11.8 ms" },
  { label: "System update", value: "5.7x faster", detail: "39.8 ms to 6.93 ms per frame" },
  { label: "Inverse recovery", value: "8 of 8 thresholds", detail: "LALTO, mean normalized error 0.0188" },
];
