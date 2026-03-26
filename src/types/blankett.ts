// src/types/blankett.ts
// Den förgyllda blanketten — Ær Ideations standardiserade kvitto/leverans.
// AI fyller enbart de dynamiska fälten; strukturen är fast och auktoritativ.

export interface RealisationPlan {
  format: string           // t.ex. "Limited edition, 300 exemplar"
  channel: string          // t.ex. "Direkt till samlare, galleripartnerskap"
  segment: string          // t.ex. "Nisch-poesiläsare, litteraturprisets krets"
  timeline: string         // t.ex. "12 månader till första utgåva"
}

/** En enskild scoring-dimension med poäng och motivering */
export interface ScoreDimension {
  score: number            // 0–20
  rationale: string        // Skarp motivering i 1 mening
}

export interface BusinessScore {
  total: number            // 0–100
  approved: boolean        // true om total >= 70
  breakdown: {
    originality: ScoreDimension            // Hur distinkt från befintlig marknad
    marketReceptivity: ScoreDimension      // Verklig efterfrågesignal
    realisability: ScoreDimension          // Kan faktiskt byggas/genomföras
    ecosystemSynergy: ScoreDimension       // Ärver från Davids befintliga
    aestheticTransformation: ScoreDimension // Ej generisk; estetiskt transformerad
  }
  verdict: string          // En auktoritativ mening
  iterationNote?: string   // Endast om approved === false
}

export interface Blankett {
  // — RUBRIK (fast) —
  label: "ÆR IDEATION — BÄRIGHETSANALYS"
  version: "1.0"
  timestamp: string        // ISO 8601

  // — IDÉ (fylls av AI) —
  ideaTitle: string
  ideaDescription: string  // 2–3 meningar, precis, inget fluff
  domain: string           // t.ex. "Publicistik / Poesi"
  genealogy: string        // Hur det kopplar till Davids befintliga ekosystem

  // — REALISERINGSPLAN (fylls av AI) —
  realisationPlan: RealisationPlan

  // — POÄNGSÄTTNING (beräknas av scoring engine) —
  score: BusinessScore
}
