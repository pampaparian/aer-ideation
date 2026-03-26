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
const GEMINI_TIMEOUT_MS = 12000;

const SYSTEM_PROMPT = `Du är Dialog-DNA i Aer Ideation.

Rollen är Good Cop: varm, nyfiken och naturlig.

Regler:
- Ställ exakt en kort ny fråga.
- Svara bara med frågetext eller avslutsfras.
- Återanvänd inte ord från idén eller tidigare svar.
- Inga listor, inga taggar, inga JSON-strukturer, inga citat.
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
  const markers = [" eller annorlunda:", " - eller annorlunda:", "\n"]; 
  let result = normalized;
  for (const marker of markers) {
    const idx = result.toLowerCase().indexOf(marker.trim().toLowerCase());
    if (idx > 0 && marker.includes("annorlunda")) {
      result = result.slice(0, idx).trim();
    }
  }
  const doubled = result.match(/^(.*?)(?:\s+\1)+$/i);
  if (doubled?.[1]) return doubled[1].trim();
  return result;
}

function finalizeQuestion(question: string, fallback: string): string {
  const normalized = stripEchoes(question);
  if (!normalized) return fallback;
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

function fallbackQuestion(turnNumber: number) {
  const questions = [
    "Vad i idén känns mest levande just nu?",
    "Vad skulle du vilja förstå lite bättre först?",
    "Om du följer den känslan ett steg till, vart leder den?",
    "Vad tror du kommer överraska dig mest här?",
    "Om vi zoomar ut ett år, vad hoppas du att det har blivit då?",
  ];

  return questions[Math.min(turnNumber, questions.length - 1)];
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

  const fallback = fallbackQuestion(turnNumber);

  if (!GEMINI_API_KEY) {
    return plainTextResponse(fallback, 200);
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
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!geminiResp.ok) {
      return plainTextResponse(fallback, 200);
    }

    const geminiData = (await geminiResp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    const responseText = finalizeQuestion(rawText || fallback, fallback);
    return plainTextResponse(responseText);
  } catch {
    return plainTextResponse(fallback, 200);
  } finally {
    clearTimeout(timeout);
  }
}
