// src/types/blankett.ts

export interface RealisationPlan {
  format: string
  channel: string
  segment: string
  timeline: string
}

export interface ScoreDimension {
  score: number
  rationale: string
}

export interface BusinessScore {
  total: number
  approved: boolean
  breakdown: {
    originality: ScoreDimension
    marketReceptivity: ScoreDimension
    realisability: ScoreDimension
    ecosystemSynergy: ScoreDimension
    aestheticTransformation: ScoreDimension
  }
  verdict: string
  iterationNote?: string
}

export interface Blankett {
  label: "ÆR IDEATION — BÄRIGHETSANALYS"
  version: "1.0"
  timestamp: string
  ideaTitle: string
  ideaDescription: string
  domain: string
  genealogy: string
  realisationPlan: RealisationPlan
  score: BusinessScore
}

export interface DialogTurn {
  role: "user" | "assistant"
  text: string
}

export type AppPhase = "input" | "dialog" | "analyzing" | "result"
