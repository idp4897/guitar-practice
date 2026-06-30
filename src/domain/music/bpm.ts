export const BPM_MIN = 20;
export const BPM_MAX = 300;

export function validateBpm(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < BPM_MIN || rounded > BPM_MAX) return null;
  return rounded;
}
