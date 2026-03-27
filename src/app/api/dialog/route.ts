// src/app/api/dialog/route.ts
// Dialog-DNA — semantiskt filter mellan pitch och analys.
// Punkt 94–106: Good Cop, 3–5 klustrade turer, front-loading, sanity check.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const DONE_MESSAGE = "Bra — jag har nog nu. Analyserar idén.";
const MAX_HISTORY_MESSAGES = 2;
const MAX_MESSAGE_CHARS = 180;
const GEMINI_TIMEOUT_MS = 10000;
const GEMINI_LOOP_ERROR = "Fel i Gemini-loopen";
const GEMINI_TIMEOUT_ERROR = "Lager 1: Timeout";

const SYSTEM_PROMPT = `Du är Dialog-DNA i Aer Ideation.

Persona:
- Intellektuell, skarp och lite fientligt nyfiken.
- Inte varm-pratig; mer precis, krävande och analytisk.
- Känn dig fri att vara rak, men aldrig otrevlig.

Syfte:
- Ställ exakt en fråga i taget.
- Frågan ska alltid driva samtalet djupare än användarens senaste formulering.
- Gå efter mekanik, struktur, drivkrafter, incitament, flaskhalsar, risker, beteende och varför idén faktiskt skulle fungera eller falla.
- Undvik abstrakta omformuleringar av användarens ord.
- Parafrasera inte, spegla inte, och återanvänd inte nyckelord från idén eller senaste svaret om det går att undvika.

Stilregler:
- Variera meningslängd och satsrytm.
- Undvik generiska mallfrågor som börjar med "Hur upplever...", "Vad får...", "På vilket sätt..." om de inte är specifikt motiverade av kontexten.
- Frågan ska kännas som att den försöker spräcka en illusion, inte bekräfta den.
- Föredra konkreta frågor om exekvering, krockar, beroenden, målgruppens faktiska beteende och vad som måste vara sant för att idén ska hålla.
- Om idén är vag, gå på definitioner, gränser och antaganden. Om den är ambitiös, gå på resurser, distribution, tid och misslyckandepunkter.

Format:
- Svara bara med frågetext eller avslutsfras.
- Inga listor, inga taggar, inga JSON-strukturer, inga citat, inga förklaringar.
- Håll frågan kort och konkret.

När tillräcklig signal finns, svara exakt: "Bra — jag har nog nu. Analyserar idén."`;

interface DialogMessage {
  role: "user" | "assistant";
  text: string;
}

interface RequestBody {
  idea: string;
  history: DialogMessage[];
  turnNumber: number;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function stripEchoes(text: string): string {
  const normalized = normalizeText(text);
  const doubled = normalized.match(/^(.*?)(?:\s+\1)+$/i);
  if (doubled?.[1]) return doubled[1].trim();
  return normalized;
}

function finalizeQuestion(question: string): string {
  const normalized = stripEchoes(question);
  if (!normalized) return "";
  if (normalized === DONE_MESSAGE) return normalized;
  const max = 220;
  const sliced = normalized.length <= max ? normalized : normalized.slice(0, max);
  const trimmed = sliced.trim();
  return /[?.!]$/.test(trimmed) ? trimmed : `${trimmed}?`;
}

function plainTextResponse(text: string, status = 200) {
  return new NextResponse(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function truncateText(text: string, limit = MAX_MESSAGE_CHARS) {
  const normalized = normalizeText(text);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

function buildHistoryContents(history: DialogMessage[]) {
  return history
    .filter((m) => m.role === "user")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: "user",
      parts: [{ text: truncateText(m.text) }],
    }));
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/dialog", runtime });
}

export async function POST(req: NextRequest) {
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

  if (!GEMINI_API_KEY) {
    return plainTextResponse(GEMINI_LOOP_ERROR, 500);
  }

  const historyContents = buildHistoryContents(history);
  const userMessage =
    turnNumber === 0
      ? `Ide: ${truncateText(idea, 700)}\nStäll en kort, varm följdfråga.`
      : `TurnNumber: ${turnNumber + 1}. Fortsätt med en ny, kort fråga utifrån senaste svaret.`;

  const contents = [...historyContents, { role: "user", parts: [{ text: userMessage }] }];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      }
    );

    if (!geminiResp.ok) {
      return plainTextResponse(GEMINI_LOOP_ERROR, 502);
    }

    const geminiData = (await geminiResp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    if (!rawText.trim()) {
      return plainTextResponse(GEMINI_LOOP_ERROR, 502);
    }

    const responseText = finalizeQuestion(rawText);
    if (!responseText) {
      return plainTextResponse(GEMINI_LOOP_ERROR, 502);
    }

    return plainTextResponse(responseText);
  } catch {
    if (controller.signal.aborted) {
      return plainTextResponse(GEMINI_TIMEOUT_ERROR, 504);
    }

    return plainTextResponse(GEMINI_LOOP_ERROR, 500);
  } finally {
    clearTimeout(timeout);
  }
}
