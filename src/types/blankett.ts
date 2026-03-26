// src/types/blankett.ts
// Den förgyllda blanketten — Ær Ideations standardiserade kvitto/leverans.
// AI fyller enbart de dynamiska fälten; strukturen är fast och auktoritativ.

export interface RealisationPlan {
  format: string           // t.ex. "Limited edition, 300 exemplar"
  channel: string          // t.ex. "Direkt till samlare, galleripartnerskap"
  segment: string          // t.ex. "Nisch-poesiläsare, litteraturprisets krets"
  timeline: string         // t.ex. "12 månader till första utgåva"
}

export interface BusinessScore {
  total: number            // 0–100
  approved: boolean        // true om total >= 70
  breakdown: {
    originality: number            // 0–20: Hur distinkt från befintlig
    marketReceptivity: number      // 0–20: Verklig efterfrågesignal
    realisability: number          // 0–20: Kan faktiskt byggas/genomföras
    ecosystemSynergy: number       // 0–20: Ärver från Davids befintliga
    aestheticTransformation: number // 0–20: Ej generisk; estetiskt transformerad
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
