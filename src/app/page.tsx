// src/app/page.tsx
// Ær Ideation — tvåruters dialog UI.
// Punkt 64: enkel, ren, snygg. Dialog i två rutor.

"use client";

import { useState } from "react";
import { Blankett } from "@/components/Blankett";
import type { Blankett as BlankettType } from "@/types/blankett";
import styles from "./page.module.css";

export default function Home() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BlankettType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Okänt fel");
      }

      const blankett = await res.json() as BlankettType;
      setResult(blankett);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleAnalyze();
    }
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.wordmark}>ÆR IDEATION</span>
      </header>

      <div className={styles.dialog}>
        {/* ── RUTA 1: INPUT ── */}
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
            onKeyDown={handleKey}
            rows={8}
            disabled={loading}
          />
          <button
            className={styles.analyzeButton}
            onClick={handleAnalyze}
            disabled={!idea.trim() || loading}
          >
            {loading ? "Analyserar..." : "Analysera"}
          </button>
          <p className={styles.hint}>⌘ + Enter för att skicka</p>
        </section>

        {/* ── RUTA 2: OUTPUT ── */}
        <section className={styles.outputPanel}>
          <label className={styles.panelLabel}>Blankett</label>
          <div className={styles.outputContent}>
            {!result && !error && !loading && (
              <p className={styles.placeholder}>
                Bärighetsanalysen visas här.
              </p>
            )}
            {loading && (
              <p className={styles.placeholder}>Genererar blankett...</p>
            )}
            {error && <p className={styles.errorText}>{error}</p>}
            {result && <Blankett data={result} />}
          </div>
        </section>
      </div>
    </main>
  );
}
