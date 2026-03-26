// src/lib/scoring.ts
// Scoring engine — tar AI:ns råbedömning och returnerar ett BusinessScore.
// Godkänd-ribba: 70/100. Under det krävs iteration.

import type { BusinessScore } from "@/types/blankett";

export interface RawScoreInput {
  originality: number
  originalityRationale: string
  marketReceptivity: number
  marketReceptivityRationale: string
  realisability: number
  realisabilityRationale: string
  ecosystemSynergy: number
  ecosystemSynergyRationale: string
  aestheticTransformation: number
  aestheticTransformationRationale: string
  verdict: string
}

export function computeScore(input: RawScoreInput): BusinessScore {
  const APPROVAL_THRESHOLD = 70;

  const breakdown = {
    originality: {
      score: clamp(input.originality, 0, 20),
      rationale: input.originalityRationale,
    },
    marketReceptivity: {
      score: clamp(input.marketReceptivity, 0, 20),
      rationale: input.marketReceptivityRationale,
    },
    realisability: {
      score: clamp(input.realisability, 0, 20),
      rationale: input.realisabilityRationale,
    },
    ecosystemSynergy: {
      score: clamp(input.ecosystemSynergy, 0, 20),
      rationale: input.ecosystemSynergyRationale,
    },
    aestheticTransformation: {
      score: clamp(input.aestheticTransformation, 0, 20),
      rationale: input.aestheticTransformationRationale,
    },
  };

  const total =
    breakdown.originality.score +
    breakdown.marketReceptivity.score +
    breakdown.realisability.score +
    breakdown.ecosystemSynergy.score +
    breakdown.aestheticTransformation.score;

  const approved = total >= APPROVAL_THRESHOLD;

  return {
    total,
    approved,
    breakdown,
    verdict: input.verdict,
    iterationNote: approved
      ? undefined
      : `Poängen ${total}/100 understiger godkänd-ribban (${APPROVAL_THRESHOLD}). Idén kräver iteration.`,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(n), min), max);
}
