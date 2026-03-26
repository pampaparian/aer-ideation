// src/app/api/analyze/route.ts
// Tar en idébeskrivning → ber Gemini 2.5 Flash fylla den förgyllda blanketten
// → kör scoring engine → returnerar komplett Blankett.

import { NextRequest, NextResponse } from "next/server";
import { computeScore, type RawScoreInput } from "@/lib/scoring";
import type { Blankett } from "@/types/blankett";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

// OBS: responseMimeType: "application/json" (JSON-mode) är AVSIKTLIGT BORTTAGEN.
// JSON-mode tvingar Gemini att hålla output inom en intern tokenbudget och
// trunkerar svaret mitt i en sträng när budgeten tar slut — därav
// "SyntaxError: Unterminated string". I fri textmodus ger modellen alltid ett
// komplett svar som vi sedan extraherar med extractJSON().
const SYSTEM_PROMPT = `Du är Davids idéanalytiker i Ær Ideation. David Stenbeck är en svensk digital konstnär, poet och publicist med 260k följare på Instagram. Hans ekosystem inkluderar: Salami Neon (poesisamling), InvokeAI-produktioner, publicistisk arkitektur (digital layout-motor), och idéer som korsar AI, konst och litteratur.

Din uppgift är att analysera en idé och fylla i den förgyllda blankettens fält. Inga hallucinationer. Inga generiska svar. Inga deckare eller frukostflingor. Idéerna måste vara artefakter i Davids specifika domän.

Returnera EXAKT denna JSON och inget annat — ingen markdown, inga kodblock, inga förklaringar före eller efter JSON-objektet:
{
  "ideaTitle": "...",
  "ideaDescription": "...",
  "domain": "...",
  "genealogy": "...",
  "realisationPlan": {
    "format": "...",
    "channel": "...",
    "segment": "...",
    "timeline": "..."
  },
  "scoreInput": {
    "originality": 0,
    "marketReceptivity": 0,
    "realisability": 0,
    "ecosystemSynergy": 0,
    "aestheticTransformation": 0,
    "verdict": "..."
  }
}

Regler för strängvärden:
- Alla strängar måste vara korrekt JSON-escapade
- Använd aldrig citationstecken (") inuti strängvärden — använd enkelfnuttar eller omskriv
- Varje fältvärde: max 2 korta meningar
- Inga radbrytningar (\n) inuti strängvärden`;

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

/**
 * Robust JSON-extraktion ur Geminis fritextsvar:
 * 1. Plockar ut innehåll ur ```json ... ``` eller ``` ... ``` kodblock om sådana finns
 * 2. Hittar yttersta { ... } och extraherar det — hanterar text före/efter JSON
 * 3. Fallback: returnerar trimmad sträng som den är
 */
function extractJSON(raw: string): string {
  const s = raw.trim();

  // Steg 1: kodblock
  const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = codeBlock ? codeBlock[1].trim() : s;

  // Steg 2: yttersta { }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return candidate.slice(start, end + 1);
  }

  return candidate;
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY saknas i miljövariablerna" },
      { status: 500 }
    );
  }

  let body: { idea?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON i request body" }, { status: 400 });
  }

  const { idea } = body;
  if (!idea || idea.trim().length === 0) {
    return NextResponse.json({ error: "Idé saknas" }, { status: 400 });
  }

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: idea }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.4,
            // responseMimeType borttagen — se kommentar ovan
          },
        }),
      }
    );
  } catch (fetchErr) {
    return NextResponse.json(
      { error: `Nätverksfel mot Gemini: ${String(fetchErr)}` },
      { status: 502 }
    );
  }

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text();
    return NextResponse.json(
      { error: `Gemini HTTP ${geminiResponse.status}: ${errText}` },
      { status: 502 }
    );
  }

  let geminiData: unknown;
  try {
    geminiData = await geminiResponse.json();
  } catch {
    return NextResponse.json(
      { error: "Gemini returnerade icke-JSON i HTTP-svaret" },
      { status: 502 }
    );
  }

  const typedData = geminiData as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
  };

  const rawText: string =
    typedData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const finishReason: string =
    typedData?.candidates?.[0]?.finishReason ?? "UNKNOWN";

  if (!rawText) {
    return NextResponse.json(
      {
        error: "Gemini returnerade tomt svar",
        finishReason,
        raw: JSON.stringify(geminiData),
      },
      { status: 502 }
    );
  }

  const extracted = extractJSON(rawText);

  let payload: GeminiPayload;
  try {
    payload = JSON.parse(extracted) as GeminiPayload;
  } catch (parseErr) {
    return NextResponse.json(
      {
        error: `Kunde inte tolka Geminis svar: ${String(parseErr)}`,
        finishReason,
        raw: rawText.slice(0, 600),
      },
      { status: 502 }
    );
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
