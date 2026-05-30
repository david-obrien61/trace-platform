// Slab-pricing: ≤$50 → 4×, ≤$200 → 2×, ≤$1000 → 1.5×, >$1000 → 1.25×. Rounds to nearest .99.
// Ported from IgnitionMobile/CodeBaseB/MarginEngine.js

const SLABS: Array<[number, number]> = [
  [50, 4],
  [200, 2],
  [1000, 1.5],
  [Infinity, 1.25],
];

export function calculateRetail(cost: number): number {
  const multiplier = SLABS.find(([cap]) => cost <= cap)![1];
  const raw = cost * multiplier;
  return Math.floor(raw) + 0.99;
}

export function calculateMargin(cost: number, retail: number): number {
  if (retail === 0) return 0;
  return +((retail - cost) / retail * 100).toFixed(1);
}
