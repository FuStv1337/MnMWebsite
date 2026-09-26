// Fit is a comparison heuristic, separate from actual character stat bonuses.
export function getDefensiveFitSkills(classDetails) {
  return ['Parry', 'Dodge', 'Block'].filter((skill) => classDetails?.defensiveSkills?.includes(skill));
}

export function getClassFitWeights(classDetails) {
  if (!classDetails?.statModifiers) return null;
  const weights = { ...classDetails.statModifiers };
  if (classDetails.role === 'Tank' || classDetails.role === 'Melee/Hybrid') {
    weights.DEX = (weights.DEX ?? 0) + 2;
  }
  const defensiveCount = getDefensiveFitSkills(classDetails).length;
  if (defensiveCount) weights.AGI = (weights.AGI ?? 0) + defensiveCount;
  return weights;
}

export function computeClassFitScore(stats, weights) {
  if (!stats || !weights) return null;
  let score = 0;
  let hasValue = false;
  for (const key of ['STR', 'STA', 'DEX', 'AGI', 'INT', 'WIS', 'CHA']) {
    const weight = weights[key] ?? 0;
    if (weight > 0 && stats[key] != null) {
      score += stats[key] * weight;
      hasValue = true;
    }
  }
  return hasValue ? score : null;
}
