// src/app/api/dialog/route.ts
// Dialog-DNA — semantiskt filter mellan pitch och analys.
// Punkt 94–106: Good Cop, 3–5 klustrade turer, front-loading, sanity check.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const DONE_MESSAGE = "Bra — jag har nog nu. Analyserar idén.";
const MAX_CONTEXT_MESSAGES = 8;
const MAX_CONTEXT_MESSAGE_CHARS = 320;
const GEMINI_TIMEOUT_MS = 10000;
const GEMINI_LOOP_ERROR = "Fel i Gemini-loopen";
const GEMINI_TIMEOUT_ERROR = "Lager 1: Timeout";
const MAX_FINAL_QUESTION_CHARS = 1200;

const SYSTEM_PROMPT = `Du är Dialog-DNA i Aer Ideation.

Persona:
- Vänlig, nyfiken och skarp.
- Krävande i sak, aldrig hostil.
- Tänk som en kritiker som vill testa om idén faktiskt håller.

Syfte:
- Ställ exakt en fråga i taget.
- Frågan ska alltid gå djupare än användarens senaste formulering.
- Gå efter mekanik, struktur, drivkrafter, incitament, flaskhalsar, risker, beteende och vad som måste vara sant för att idén ska fungera.
- Undvik abstrakta omformuleringar av användarens ord.
- Parafrasera inte, spegla inte, och återanvänd inte nyckelord från idén eller senaste svaret om det går att undvika.

Rotationsregel:
- Om ett hinder, en risk eller en säkerhetsfråga redan har fått ett svar, lämna den axeln.
- Stanna inte i samma tema flera turer i rad.
- Aldrig tre frågor i rad som betyder samma sak som "Vad förhindrar..." eller "Vad hindrar...".
- När ett sådant spår är besvarat, byt omedelbart till en annan dimension av idén: ritual, estetik, litterärt värde, användarupplevelse, distribution, social energi, format, eller ekonomi.
- Om dialogen nyss har kretsat kring security/copying, fortsätt inte att pressa just det spåret; gå vidare till hur idén känns, används, ser ut, cirkulerar eller blir minnesvärd.

Stilregler:
- Variera meningslängd och satsrytm.
- Undvik generiska mallfrågor som börjar med "Hur upplever...", "Vad får...", "På vilket sätt..." om de inte är tydligt motiverade av kontexten.
- Frågan ska kännas som att den försöker spräcka en illusion, inte bekräfta den.
- Föredra konkreta frågor om exekvering, krockar, beroenden, målgruppens faktiska beteende och misslyckandepunkter.
- När säkerhetsfrågan är mättad, gå vidare till ritual, estetik eller litterärt värde istället för att återvända till blockeraren.
- Om idén är vag, gå på definitioner, gränser och antaganden. Om den är ambitiös, gå på resurser, distribution, tid och reala hinder.

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

function trimToWordBoundary(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace <= 0) return sliced.trim();
  return sliced.slice(0, lastSpace).trim();
}

function stripTrailingClippingMarks(text: string): string {
  return text.replace(/[\s,;:\-—]+$/u, "").trim();
}

function finalizeQuestion(question: string): string {
  const normalized = stripEchoes(question);
  if (!normalized) return "";
  if (normalized === DONE_MESSAGE) return normalized;

  const wasClipped = normalized.length > MAX_FINAL_QUESTION_CHARS;
  const safeText = trimToWordBoundary(normalized, MAX_FINAL_QUESTION_CHARS);
  const cleaned = stripTrailingClippingMarks(safeText);
  if (!cleaned) return "";

  if (/[?.!]$/.test(cleaned)) return cleaned;
  if (wasClipped) return cleaned;
  return `${cleaned}?`;
}

function plainTextResponse(text: string, status = 200) {
  return new NextResponse(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function truncateText(text: string, limit = MAX_CONTEXT_MESSAGE_CHARS) {
  const normalized = normalizeText(text);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

function buildHistoryContents(history: DialogMessage[]) {
  return history.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
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
      ? `Ide: ${truncateText(idea, 700)}\nStäll en kort, skarp följdfråga.`
      : `TurnNumber: ${turnNumber + 1}. Fortsätt med en ny fråga utifrån senaste svaret, men byt axel om ett spår redan är mättat.`;

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
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Dialog Gemini HTTP error", {
        status: geminiResp.status,
        errText,
      });
      return plainTextResponse(`Gemini HTTP ${geminiResp.status}: ${errText}`, 502);
    }

    const geminiData = (await geminiResp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };

    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    if (!rawText.trim()) {
      const blockReason = geminiData?.promptFeedback?.blockReason;
      console.error("Dialog Gemini empty response", {
        blockReason,
        promptFeedback: geminiData?.promptFeedback,
      });
      return plainTextResponse(
        blockReason ? `Gemini tomt svar: ${blockReason}` : "Gemini tomt svar",
        502
      );
    }

    const responseText = finalizeQuestion(rawText);
    if (!responseText) {
      console.error("Dialog Gemini parse/cleanup produced empty question", { rawText });
      return plainTextResponse("Gemini tomt svar", 502);
    }

    return plainTextResponse(responseText);
  } catch (err) {
    if (controller.signal.aborted) {
      return plainTextResponse(GEMINI_TIMEOUT_ERROR, 504);
    }

    console.error("Dialog Gemini fetch failed", { err: String(err) });
    return plainTextResponse(GEMINI_LOOP_ERROR, 500);
  } finally {
    clearTimeout(timeout);
  }
}
