// src/app/api/dialog/route.ts
// Dialog-DNA — semantiskt filter mellan pitch och analys.
// Punkt 94–106: Good Cop, 3–5 klustrade turer, front-loading, sanity check.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const DONE_MESSAGE = "Bra — jag har nog nu. Analyserar idén.";

const SYSTEM_PROMPT = `Du ar Dialog-DNA i Aer Ideation — ett samtalslager som samlar precis nog kontext innan analysen.

PERSONA: Good Cop. Vänlig, nyfiken, organisk.

UPPDRAG: Ställ 3–5 korta, klustrade frågor. Håll varje fråga under 220 tecken om möjligt. Extrahera signal snabbt och avsluta när informationsmättnad är nådd.

STRUKTUR:
- Tur 1–2: lite längre, men fortfarande tighta.
- Tur 3–4: kortare och mer riktade.
- Tur 3 ska alltid innehålla en enkel 12-månadersbild om det finns tillräckligt med underlag.
- Tur 4–5: vänlig men tydlig verklighetskontroll.

SANITY CHECK: Om svaret saknar substans eller planen är extrem utan struktur, sätt auditTriggered: true.

AVSLUTNING: När tillräcklig signal är samlad, sätt done: true. Gör detta senast vid tur 5.

Svara endast med vanlig text som en enda fråga eller med avslutsfrasen. Använd inte JSON, markdown eller kodblock.

Om done är true, svara exakt: "Bra — jag har nog nu. Analyserar idén."`;

interface DialogMessage {
  role: "user" | "assistant";
  text: string;
}

interface RequestBody {
  idea: string;
  history: DialogMessage[];
  turnNumber: number;
}

function finalizeQuestion(question: string, fallback: string): string {
  const normalized = question.trim().replace(/\s+/g, " ");
  if (!normalized) return fallback;
  if (normalized === DONE_MESSAGE) return normalized;
  const max = 220;
  const sliced = normalized.length <= max ? normalized : normalized.slice(0, max);
  if (normalized.length <= max) return /[?.!]$/.test(sliced) ? sliced : `${sliced}?`;
  const boundary = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("? "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(", "),
    sliced.lastIndexOf(" ")
  );
  const safe = sliced.slice(0, boundary > 80 ? boundary : max).trim();
  return /[?.!]$/.test(safe) ? safe : `${safe}?`;
}

function plainTextResponse(text: string, status = 200) {
  return new NextResponse(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/dialog" });
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return plainTextResponse("GOOGLE_GENERATIVE_AI_API_KEY saknas", 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return plainTextResponse("Ogiltig JSON", 400);
  }

  const { idea, history = [], turnNumber = 0 } = body;

  if (!idea?.trim()) {
    return plainTextResponse("Ide saknas", 400);
  }

  const historyContents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const userMessage =
    turnNumber === 0
      ? `Ide: ${idea}\n\nTurnNumber: 1. Stall din forsta klustrade fraga.`
      : `TurnNumber: ${turnNumber + 1}. Fortsatt dialogen baserat pa historiken ovan.`;

  const contents = [...historyContents, { role: "user", parts: [{ text: userMessage }] }];

  let geminiResp: Response;
  try {
    geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      }
    );
  } catch (fetchErr) {
    return plainTextResponse(`Natverksfel: ${String(fetchErr)}`, 502);
  }

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    return plainTextResponse(`Gemini HTTP ${geminiResp.status}: ${errText}`, 502);
  }

  const geminiData = (await geminiResp.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const rawText =
    geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  let responseText = rawText.trim();

  if (responseText.startsWith("{")) {
    try {
      const parsed = JSON.parse(responseText) as { question?: string; done?: boolean };
      if (typeof parsed.question === "string" && parsed.question.trim()) {
        responseText = parsed.question.trim();
      }
      if (parsed.done) {
        responseText = DONE_MESSAGE;
      }
    } catch {
      // Fall back to the raw text below.
    }
  }

  responseText = finalizeQuestion(responseText || "Kan du berätta mer om idén?", "Kan du berätta mer om idén?");

  if (turnNumber >= 5 && responseText !== DONE_MESSAGE) {
    responseText = DONE_MESSAGE;
  }

  return plainTextResponse(responseText);
}
