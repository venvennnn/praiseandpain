import jStat from "jstat";

/**
 * Beta(1+C, 1+M-C) posterior for binary complaint share with Jeffreys-style
 * uniform prior Beta(1,1). Returns mean and central 95% credible interval.
 */
export function betaComplaintShare(
  complaints: number,
  mentions: number,
): { mean: number; lower: number; upper: number } | null {
  if (!Number.isFinite(complaints) || !Number.isFinite(mentions)) return null;
  if (mentions <= 0 || complaints < 0 || complaints > mentions) return null;

  const alpha = 1 + complaints;
  const beta = 1 + (mentions - complaints);
  const mean = alpha / (alpha + beta);
  const lower = jStat.beta.inv(0.025, alpha, beta);
  const upper = jStat.beta.inv(0.975, alpha, beta);
  return { mean, lower, upper };
}

/** Mulberry32 seeded PRNG for reproducible posterior draws. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleBeta(
  alpha: number,
  betaParam: number,
  rng: () => number,
): number {
  // jStat.beta.sample uses Math.random; invert CDF with seeded RNG instead.
  const u = Math.min(Math.max(rng(), 1e-12), 1 - 1e-12);
  return jStat.beta.inv(u, alpha, betaParam);
}

export function posteriorDifferenceProbability(params: {
  complaintsA: number;
  mentionsA: number;
  complaintsB: number;
  mentionsB: number;
  practicalThreshold: number;
  draws?: number;
  seed?: number;
}): { probabilityABetter: number; meanDifference: number } | null {
  const {
    complaintsA,
    mentionsA,
    complaintsB,
    mentionsB,
    practicalThreshold,
    draws = 5000,
    seed = 42,
  } = params;

  if (mentionsA <= 0 || mentionsB <= 0) return null;

  const alphaA = 1 + complaintsA;
  const betaA = 1 + (mentionsA - complaintsA);
  const alphaB = 1 + complaintsB;
  const betaB = 1 + (mentionsB - complaintsB);
  const rng = mulberry32(seed);

  let better = 0;
  let sumDiff = 0;
  for (let i = 0; i < draws; i++) {
    const a = sampleBeta(alphaA, betaA, rng);
    const b = sampleBeta(alphaB, betaB, rng);
    // Lower complaint share is better for the entity.
    const diff = b - a;
    sumDiff += diff;
    if (diff >= practicalThreshold) better += 1;
  }

  return {
    probabilityABetter: better / draws,
    meanDifference: sumDiff / draws,
  };
}
