// src/components/Blankett.tsx
// Den förgyllda blanketten — standardiserat kvitto/leverans UI.
// Strukturen är fast; AI fyller enbart de dynamiska fälten.

import type { Blankett as BlankettType } from "@/types/blankett";
import styles from "./Blankett.module.css";

interface Props {
  data: BlankettType;
}

export function Blankett({ data }: Props) {
  const { score } = data;
  const scorePercent = `${score.total}%`;

  return (
    <article className={styles.blankett}>
      {/* ── RUBRIK ── */}
      <header className={styles.header}>
        <span className={styles.label}>{data.label}</span>
        <span className={styles.meta}>
          v{data.version} &middot;{" "}
          {new Date(data.timestamp).toLocaleDateString("sv-SE", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </header>

      {/* ── IDÉ ── */}
      <section className={styles.section}>
        <h2 className={styles.fieldLabel}>IDÉ</h2>
        <p className={styles.ideaTitle}>{data.ideaTitle}</p>
        <p className={styles.ideaDescription}>{data.ideaDescription}</p>
        <div className={styles.fieldRow}>
          <span className={styles.fieldKey}>Domän</span>
          <span className={styles.fieldValue}>{data.domain}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldKey}>Släktskap</span>
          <span className={styles.fieldValue}>{data.genealogy}</span>
        </div>
      </section>

      {/* ── REALISERINGSPLAN ── */}
      <section className={styles.section}>
        <h2 className={styles.fieldLabel}>REALISERINGSPLAN</h2>
        {([
          ["Format", data.realisationPlan.format],
          ["Kanal", data.realisationPlan.channel],
          ["Segment", data.realisationPlan.segment],
          ["Tidslinje", data.realisationPlan.timeline],
        ] as [string, string][]).map(([key, val]) => (
          <div className={styles.fieldRow} key={key}>
            <span className={styles.fieldKey}>{key}</span>
            <span className={styles.fieldValue}>{val}</span>
          </div>
        ))}
      </section>

      {/* ── BÄRIGHETSANALYS ── */}
      <section className={styles.section}>
        <h2 className={styles.fieldLabel}>BÄRIGHETSANALYS</h2>

        <div className={styles.scoreBar}>
          <div
            className={`${styles.scoreFill} ${
              score.approved ? styles.approved : styles.rejected
            }`}
            style={{ width: scorePercent }}
          />
        </div>

        <div className={styles.scoreTotal}>
          <span
            className={`${styles.scoreBadge} ${
              score.approved ? styles.badgeApproved : styles.badgeRejected
            }`}
          >
            {score.total}/100
          </span>
          <span className={styles.scoreStatus}>
            {score.approved ? "GODKÄND" : "KRÄVER ITERATION"}
          </span>
        </div>

        <div className={styles.breakdown}>
          {([
            ["Originalitet", score.breakdown.originality],
            ["Marknadsmottaglighet", score.breakdown.marketReceptivity],
            ["Realiserbarhet", score.breakdown.realisability],
            ["Ekosystemsynergi", score.breakdown.ecosystemSynergy],
            ["Estetisk transformation", score.breakdown.aestheticTransformation],
          ] as [string, number][]).map(([label, val]) => (
            <div className={styles.breakdownRow} key={label}>
              <span className={styles.breakdownLabel}>{label}</span>
              <span className={styles.breakdownScore}>{val}/20</span>
            </div>
          ))}
        </div>

        <p className={styles.verdict}>{score.verdict}</p>
        {score.iterationNote && (
          <p className={styles.iterationNote}>{score.iterationNote}</p>
        )}
      </section>
    </article>
  );
}
