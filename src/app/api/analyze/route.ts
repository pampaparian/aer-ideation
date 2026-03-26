// src/app/api/analyze/route.ts
// Tar en idébeskrivning → ber Gemini 2.5 Flash fylla den förgyllda blanketten
// → kör scoring engine → returnerar komplett Blankett.

import { NextRequest, NextResponse } from "next/server";
import { computeScore } from "@/lib/scoring";
import type { Blankett, RawScoreInput } from "@/types/blankett";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17";

const SYSTEM_PROMPT = `Du är Davids idéanalytiker i Ær Ideation. David Stenbeck är en svensk digital konstnär, poet och publicist med 260k följare på Instagram. Hans ekosystem inkluderar: Salami Neon (poesisamling), InvokeAI-produktioner, publicistisk arkitektur (digital layout-motor), och idéer som korsar AI, konst och litteratur.

Din uppgift är att analysera en idé och fylla i den förgyllda blankettens fält. Inga hallucinationer. Inga generiska svar. Inga deckare eller frukostflingor. Idéerna måste vara artefakter i Davids specifika domän.

Returnera EXAKT denna JSON — inget annat:
{
  "ideaTitle": "...",
  "ideaDescription": "... (2-3 meningar, precis, inget fluff)",
  "domain": "...",
  "genealogy": "... (hur idén kopplar till Davids befintliga ekosystem)",
  "realisationPlan": {
    "format": "...",
    "channel": "...",
    "segment": "...",
    "timeline": "..."
  },
  "scoreInput": {
    "originality": <0-20>,
    "marketReceptivity": <0-20>,
    "realisability": <0-20>,
    "ecosystemSynergy": <0-20>,
    "aestheticTransformation": <0-20>,
    "verdict": "... (en auktoritativ mening om idéns bärighet)"
  }
}`;

interface GeminiPayload {
  ideaTitle: string;
  ideaDescription: string;
  domain: string;
  genealogy: string;
  realisationPlan: {
    format: string;
    channel: string;
    segment: string;
    timeline: string;
  };
  scoreInput: RawScoreInput;
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "API key missing" }, { status: 500 });
  }

  const body = await req.json();
  const { idea } = body as { idea: string };

  if (!idea || idea.trim().length === 0) {
    return NextResponse.json({ error: "Idé saknas" }, { status: 400 });
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: idea }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const err = await geminiResponse.text();
    return NextResponse.json({ error: `Gemini-fel: ${err}` }, { status: 502 });
  }

  const geminiData = await geminiResponse.json();
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  let payload: GeminiPayload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Kunde inte tolka Geminis svar" }, { status: 502 });
  }

  const score = computeScore(payload.scoreInput);

  const blankett: Blankett = {
    label: "ÆR IDEATION — BÄRIGHETSANALYS",
    version: "1.0",
    timestamp: new Date().toISOString(),
    ideaTitle: payload.ideaTitle,
    ideaDescription: payload.ideaDescription,
    domain: payload.domain,
    genealogy: payload.genealogy,
    realisationPlan: payload.realisationPlan,
    score,
  };

  return NextResponse.json(blankett);
}
