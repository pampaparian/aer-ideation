// src/app/api/dialog/route.ts
// Dialog-DNA — semantiskt filter mellan pitch och analys.
// Punkt 94–106: Good Cop, 3–5 klustrade turer, front-loading, sanity check.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

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

Returnera exakt JSON utan markdown eller kodblock: {"question":"...","done":false,"turnNumber":1,"auditTriggered":false}

Om done är true, sätt question till: "Bra — jag har nog nu. Analyserar idén."`;

interface DialogMessage {
  role: "user" | "assistant";
  text: string;
}

interface RequestBody {
  idea: string;
  history: DialogMessage[];
  turnNumber: number;
}

interface GeminiDialogResponse {
  question: string;
  done: boolean;
  turnNumber: number;
  auditTriggered: boolean;
}

function finalizeQuestion(question: string, fallback: string): string {
  const normalized = question.trim().replace(/\s+/g, " ");
  if (!normalized) return fallback;
  if (normalized === "Bra — jag har nog nu. Analyserar idén.") return normalized;
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

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/dialog" });
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY saknas" }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }

  const { idea, history = [], turnNumber = 0 } = body;

  if (!idea?.trim()) {
    return NextResponse.json({ error: "Ide saknas" }, { status: 400 });
  }

  const historyContents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const userMessage =
    turnNumber === 0
      ? `Ide: ${idea}\n\nTurnNumber: 1. Stall din forsta klustrade fraga.`
      : `TurnNumber: ${turnNumber + 1}. Fortsatt dialogen baserat pa historiken ovan.`;

  const contents = [
    ...historyContents,
    { role: "user", parts: [{ text: userMessage }] },
  ];

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
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        }),
      }
    );
  } catch (fetchErr) {
    return NextResponse.json({ error: `Natverksfel: ${String(fetchErr)}` }, { status: 502 });
  }

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    return NextResponse.json({ error: `Gemini HTTP ${geminiResp.status}: ${errText}` }, { status: 502 });
  }

  const geminiData = await geminiResp.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  const jsonStr = start !== -1 && end > start ? rawText.slice(start, end + 1) : rawText;

  let parsed: GeminiDialogResponse;
  try {
    parsed = JSON.parse(jsonStr) as GeminiDialogResponse;
  } catch {
    parsed = {
      question: rawText.trim() || "Kan du berätta mer om idén?",
      done: false,
      turnNumber: turnNumber + 1,
      auditTriggered: false,
    };
  }

  parsed.question = finalizeQuestion(parsed.question, "Kan du berätta mer om idén?");

  if (parsed.turnNumber >= 5 && !parsed.done) {
    parsed.done = true;
    parsed.question = "Bra — jag har nog nu. Analyserar idén.";
  }

  return NextResponse.json(parsed);
}
