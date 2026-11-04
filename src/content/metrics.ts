export type Metric = { label: string; value: string; detail: string };

export const metrics: Metric[] = [
  { label: "ECS add/remove", value: "8.6x faster", detail: "100k entities: 99.8 ms to 11.8 ms" },
  { label: "System update", value: "5.7x faster", detail: "39.8 ms to 6.93 ms per frame" },
  { label: "Component lookups", value: "100M in 2.78 s", detail: "27.8 ns per access" },
];
