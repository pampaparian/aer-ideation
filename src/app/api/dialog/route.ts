// src/app/api/dialog/route.ts
// Dialog-DNA — semantiskt filter mellan pitch och analys.
// Punkt 94–106: Good Cop, 3–5 klustrade turer, front-loading, sanity check.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const DONE_MESSAGE = "Bra — jag har nog nu. Analyserar idén.";
const MAX_HISTORY_MESSAGES = 4;
const MAX_MESSAGE_CHARS = 260;
const GEMINI_TIMEOUT_MS = 12000;

const SYSTEM_PROMPT = `Du ar Dialog-DNA i Aer Ideation — ett samtalslager som samlar precis nog kontext innan analysen.

PERSONA: Good Cop. Vänlig, nyfiken, organisk.

UPPDRAG: Ställ 3–5 korta, klustrade frågor. Håll varje fråga under 220 tecken om möjligt. Extrahera signal snabbt och avsluta när informationsmättnad är nådd.

VIKTIGT:
- Ställ exakt en ny fråga per tur.
- Återanvänd inte formuleringar från idén eller tidigare svar.
- Citatera inte användarens text.
- Svara endast med ren fråga eller avslutsfras.

STRUKTUR:
- Tur 1–2: lite längre, men fortfarande tighta.
- Tur 3–4: kortare och mer riktade.
- Tur 3 ska alltid innehålla en enkel 12-månadersbild om det finns tillräckligt med underlag.
- Tur 4–5: vänlig men tydlig verklighetskontroll.

SANITY CHECK: Om svaret saknar substans eller planen är extrem utan struktur, sätt auditTriggered: true.

AVSLUTNING: När tillräcklig signal är samlad, sätt done: true. Gör detta senast vid tur 5.

Output ONLY the text for the next question. Do NOT use JSON, do NOT use code blocks, and do NOT use any structural tags.

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

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function dedupeRepeatedPhrases(text: string): string {
  const normalized = normalizeText(text);
  const marker = " eller annorlunda: ";
  const idx = normalized.toLowerCase().indexOf(marker);
  if (idx !== -1) {
    return normalizeText(normalized.slice(0, idx));
  }

  const parts = normalized.split(/\s{2,}|[|]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0] === parts[1]) {
    return parts[0];
  }

  const sentenceParts = normalized.split(/(?<=[?.!])\s+/);
  if (sentenceParts.length >= 2) {
    const unique: string[] = [];
    for (const sentence of sentenceParts) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      if (unique.includes(trimmed)) continue;
      unique.push(trimmed);
    }
    return unique.join(" ");
  }

  return normalized;
}

function finalizeQuestion(question: string, fallback: string): string {
  const normalized = dedupeRepeatedPhrases(question);
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
    "Vad är den viktigaste kärnan i idén?",
    "Vem är detta mest för?",
    "Vilket problem vill du lösa först?",
    "Vad är den största risk du ser just nu?",
    "Hur skulle du märka om detta fungerar om 12 månader?",
  ];

  return questions[Math.min(turnNumber, questions.length - 1)];
}

function safeFallback(turnNumber: number) {
  return fallbackQuestion(turnNumber);
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

  const fallback = safeFallback(turnNumber);

  if (!GEMINI_API_KEY) {
    return plainTextResponse(fallback, 200);
  }

  const historyContents = buildHistoryContents(history);

  const userMessage =
    turnNumber === 0
      ? `Ide: ${truncateText(idea, 900)}\n\nTurnNumber: 1. Stall en ny, kort klustrad fraga.`
      : `TurnNumber: ${turnNumber + 1}. Fortsatt dialogen baserat pa tidigare user-svar.`;

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
          generationConfig: { temperature: 0.25, maxOutputTokens: 1024 },
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
