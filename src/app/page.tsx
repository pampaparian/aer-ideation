// src/app/page.tsx
// Ær Ideation — Dialog-DNA flöde.
// Punkt 94–106: pitch → dialog (3–5 turer, Good Cop) → analys (Bad Cop-kvitto).

"use client";

import { useState, useRef, useEffect } from "react";
import { Blankett } from "@/components/Blankett";
import type { Blankett as BlankettType, DialogTurn, AppPhase } from "@/types/blankett";
import styles from "./page.module.css";

const DONE_MESSAGE = "Bra — jag har nog nu. Analyserar idén.";

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>("input");
  const [idea, setIdea] = useState("");
  const [history, setHistory] = useState<DialogTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [userReply, setUserReply] = useState("");
  const [turnNumber, setTurnNumber] = useState(0);
  const [result, setResult] = useState<BlankettType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForQuestion, setIsWaitingForQuestion] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, currentQuestion]);

  async function handleStartDialog() {
    if (!idea.trim()) return;
    setPhase("dialog");
    setError(null);
    await fetchNextQuestion([], 0);
  }

  function handleIdeaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleStartDialog();
  }

  async function fetchNextQuestion(hist: DialogTurn[], turn: number) {
    setIsWaitingForQuestion(true);
    try {
      const res = await fetch("/api/dialog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, history: hist, turnNumber: turn }),
      });
      const text = await res.text();
      const trimmed = text.trim();

      if (!res.ok) {
        setError(trimmed || "Fel i Gemini-loopen");
        setCurrentQuestion("");
        setPhase("result");
        return;
      }

      if (!trimmed) {
        setError("Fel i Gemini-loopen");
        setCurrentQuestion("");
        setPhase("result");
        return;
      }

      setCurrentQuestion(trimmed);
      setTurnNumber(turn + 1);
      if (trimmed === DONE_MESSAGE) {
        void startAnalysis(hist);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fel i Gemini-loopen");
      setCurrentQuestion("");
      setPhase("result");
    } finally {
      setIsWaitingForQuestion(false);
    }
  }

  async function handleSendReply() {
    if (!userReply.trim() || !currentQuestion) return;
    const newHistory: DialogTurn[] = [
      ...history,
      { role: "assistant", text: currentQuestion },
      { role: "user", text: userReply },
    ];
    setHistory(newHistory);
    setUserReply("");
    setCurrentQuestion("");
    await fetchNextQuestion(newHistory, turnNumber);
  }

  function handleReplyKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendReply();
  }

  async function startAnalysis(hist: DialogTurn[]) {
    setPhase("analyzing");
    setError(null);
    const dialogContext = hist
      .map((t) => `${t.role === "assistant" ? "Q" : "A"}: ${t.text}`)
      .join("\n");
    const enrichedIdea = `ORIGINAL IDÉ:\n${idea}\n\nDIALOG-KONTEXT (Dialog-DNA):\n${dialogContext}`;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: enrichedIdea }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Okänt fel");
      }
      const blankett = await res.json() as BlankettType;
      setResult(blankett);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
      setPhase("result");
    }
  }

  function handleReset() {
    setPhase("input");
    setIdea("");
    setHistory([]);
    setCurrentQuestion("");
    setUserReply("");
    setTurnNumber(0);
    setResult(null);
    setError(null);
    setIsWaitingForQuestion(false);
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.wordmark}>ÆR IDEATION</span>
      </header>

      {phase === "input" && (
        <div className={styles.singlePanel}>
          <section className={styles.inputPanel}>
            <label className={styles.panelLabel} htmlFor="idea-input">
              Din idé
            </label>
            <textarea
              id="idea-input"
              className={styles.textarea}
              placeholder="Beskriv din idé..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={handleIdeaKey}
              rows={8}
            />
            <button
              className={styles.analyzeButton}
              onClick={handleStartDialog}
              disabled={!idea.trim() || isWaitingForQuestion}
            >
              Fortsätt
            </button>
            <p className={styles.hint}>⌘ + Enter för att fortsätta</p>
          </section>
        </div>
      )}

      {phase === "dialog" && (
        <div className={styles.dialogPhase}>
          <div className={styles.chatWindow}>
            {history.map((turn, i) => (
              <div
                key={i}
                className={
                  turn.role === "assistant"
                    ? styles.chatBubbleAI
                    : styles.chatBubbleUser
                }
              >
                {turn.text}
              </div>
            ))}
            {currentQuestion && (
              <div className={styles.chatBubbleAI}>
                {currentQuestion}
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          {currentQuestion && (
            <div className={styles.replyRow}>
              <textarea
                className={styles.replyTextarea}
                placeholder="Ditt svar..."
                value={userReply}
                onChange={(e) => setUserReply(e.target.value)}
                onKeyDown={handleReplyKey}
                rows={3}
                autoFocus
              />
              <button
                className={styles.sendButton}
                onClick={handleSendReply}
                disabled={!userReply.trim() || isWaitingForQuestion}
              >
                Skicka
              </button>
            </div>
          )}
          <p className={styles.hint}>⌘ + Enter för att skicka</p>
        </div>
      )}

      {phase === "analyzing" && (
        <div className={styles.singlePanel}>
          <section className={styles.inputPanel}>
            <p className={styles.placeholder}>Analyserar idén...</p>
          </section>
        </div>
      )}

      {phase === "result" && (
        <div className={styles.dialog}>
          <section className={styles.inputPanel}>
            <label className={styles.panelLabel}>Original idé</label>
            <p className={styles.ideaRecap}>{idea}</p>
            <button className={styles.resetButton} onClick={handleReset}>
              Ny idé
            </button>
          </section>
          <section className={styles.outputPanel}>
            <label className={styles.panelLabel}>Blankett</label>
            <div className={styles.outputContent}>
              {error && <p className={styles.errorText}>{error}</p>}
              {result && <Blankett data={result} />}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
