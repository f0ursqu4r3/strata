/**
 * Prefix sums of row heights: offsets[i] is the top of row i, offsets[n] the total height.
 * Rows without a measured height use the estimate.
 */
export function buildOffsets(
  ids: readonly string[],
  heights: ReadonlyMap<string, number>,
  estimate: number,
): Float64Array {
  const offsets = new Float64Array(ids.length + 1)
  for (let i = 0; i < ids.length; i++) {
    offsets[i + 1] = offsets[i]! + (heights.get(ids[i]!) ?? estimate)
  }
  return offsets
}

/** Index of the row that contains y (clamped to [0, n - 1]); 0 when there are no rows. */
export function findRowAt(offsets: Float64Array, y: number): number {
  const n = offsets.length - 1
  if (n <= 0) return 0
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid]! <= y) lo = mid
    else hi = mid - 1
  }
  return lo
}
