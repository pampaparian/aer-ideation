// src/lib/scoring.ts
// Scoring engine — tar AI:ns råbedömning och returnerar ett BusinessScore.
// Godkänd-ribba: 70/100. Under det krävs iteration.

import type { BusinessScore } from "@/types/blankett";

export interface RawScoreInput {
  originality: number
  marketReceptivity: number
  realisability: number
  ecosystemSynergy: number
  aestheticTransformation: number
  verdict: string
}

export function computeScore(input: RawScoreInput): BusinessScore {
  const APPROVAL_THRESHOLD = 70;

  const breakdown = {
    originality: clamp(input.originality, 0, 20),
    marketReceptivity: clamp(input.marketReceptivity, 0, 20),
    realisability: clamp(input.realisability, 0, 20),
    ecosystemSynergy: clamp(input.ecosystemSynergy, 0, 20),
    aestheticTransformation: clamp(input.aestheticTransformation, 0, 20),
  };

  const total =
    breakdown.originality +
    breakdown.marketReceptivity +
    breakdown.realisability +
    breakdown.ecosystemSynergy +
    breakdown.aestheticTransformation;

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
