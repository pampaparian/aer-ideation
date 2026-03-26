// src/app/api/dialog/route.ts
// Dialog-DNA — semantiskt filter mellan pitch och analys.
// Punkt 94–106: Good Cop, 3–5 klustrade turer, front-loading, sanity check.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Du ar Dialog-DNA i Aer Ideation — ett intelligent samtalslager som extraherar djup kontext ur en ide innan den slutliga analysen.

PERSONA: Good Cop. Vänlig, nyfiken, organisk. Aldrig myndighetsblankett-känsla.

UPPDRAG: Ställ 3–5 frågeturer. Varje tur är ett kluster — en fråga kan innehålla 2–3 tätt sammankopplade delfrågor. Extrahera signal. Avsluta när informationsmättnad är nådd.

STRUKTURPRINCIPER:
- Tur 1–2: Lång, tung, klustrad. Front-load kognitiv tyngd.
- Tur 3–4: Kortare. Finslipa detaljer, utmana mjukt.
- Tur 3 inkluderar alltid: projicerad 12-månadersomsättning med rationale (ekonomiskt stresstest).
- Tur 4–5 (Critical Final Sprint): Vänlig men skarp verklighetsutmaning.

SANITY CHECK: Om svaret saknar substans ELLER ambitionen är extrem utan plan, utlös audit-tur. Sätt auditTriggered: true.

AVSLUTNING: När tillräcklig signal är samlad, sätt done: true. Gör detta senast vid tur 5.

RETURNERA ALLTID exakt denna JSON utan markdown eller kodblock:
{"question":"...","done":false,"turnNumber":1,"auditTriggered":false}

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
          generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
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

  if (parsed.turnNumber >= 5 && !parsed.done) {
    parsed.done = true;
    parsed.question = "Bra — jag har nog nu. Analyserar idén.";
  }

  return NextResponse.json(parsed);
}
