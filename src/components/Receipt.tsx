'use client'

import { useState, useMemo } from 'react'
import type { IdeaNode } from '@/lib/types'
import styles from './Receipt.module.css'

interface Props {
  root: IdeaNode
  path: IdeaNode[]
  thing: string
  onBack: () => void
  onReset: () => void
}

const KIND_LABELS: Record<string, string> = {
  root: 'ursprung',
  mutation: 'mutation',
  symbiosis: 'symbios',
  parasite: 'parasit',
  adaptation: 'adaption',
  extinction: 'utrotning',
  emergence: 'emergens',
}

// Deterministic barcode pattern (avoids hydration mismatch)
const BARCODE = [
  1,0.9,1,0.2,1,1,0.3,1,0.8,1,0.2,1,
  1,0.4,1,1,0.9,0.2,1,1,0.5,1,0.2,1,
  1,1,0.3,1,0.8,1,0.2,1,1,0.6,1,0.2,
  1,0.9,1,0.3,1,1,0.2,1,0.8,1,0.4,1,
]
const BAR_WIDTHS = [1,1,2,1,1,1,2,1,1,1,1,2,1,1,2,1,1,1,2,1,1,1,1,2,1,1,1,2,1,1,1,1,2,1,1,1,2,1,1,1,1,2,1,1,2,1,1,1]

export default function Receipt({ root, path, thing, onBack, onReset }: Props) {
  const [exported, setExported] = useState(false)
  const [exporting, setExporting] = useState(false)

  const timestamp = useMemo(() => {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
  }, [])

  const chain = useMemo(() => [root, ...path], [root, path])

  async function handlePaydayExport() {
    setExporting(true)
    const payload = {
      id: crypto.randomUUID(),
      source: 'aer-ideation',
      slot: '03',
      createdAt: new Date().toISOString(),
      thing,
      chain: chain.map(n => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        description: n.description,
        depth: n.depth,
      })),
      status: 'pending',
    }

    try {
      // Stub endpoint — replace with Aer Payday (Slot 05) API when built
      await fetch('/api/payday-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (_) {
      // Graceful fail — localStorage is the source of truth until Payday exists
    }

    // Client-side inbox — persists until Aer Payday is built
    const existing = JSON.parse(
      (typeof window !== 'undefined' && localStorage.getItem('aer-payday-inbox')) || '[]'
    )
    localStorage.setItem('aer-payday-inbox', JSON.stringify([...existing, payload]))

    setExporting(false)
    setExported(true)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.receipt}>

        <div className={styles.topMeta}>
          <span className={styles.slotTag}>ÆR · SLOT 03</span>
          <span className={styles.ts}>{timestamp}</span>
        </div>

        <div className={styles.titleRow}>
          <span className={styles.receiptTitle}>RECEPT</span>
          <span className={styles.receiptSub}>innovationsbiologi</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <span className={styles.sectionLabel}>GREJ</span>
          <span className={styles.grej}>{thing}</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <span className={styles.sectionLabel}>HÄRLEDNING</span>
          <div className={styles.derivation}>
            {chain.map((node, i) => (
              <span key={node.id} className={styles.derivStep}>
                {i > 0 && <span className={styles.derivArrow}>→</span>}
                <span className={styles.derivKind}>{KIND_LABELS[node.kind]}</span>
                <span className={styles.derivLabel}>{node.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.steps}>
          {chain.map((node, i) => (
            <div key={node.id} className={styles.step}>
              <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
              <div className={styles.stepContent}>
                <span className={styles.stepKind}>{KIND_LABELS[node.kind]}</span>
                <span className={styles.stepLabel}>{node.label}</span>
                <span className={styles.stepDesc}>{node.description}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.barcode}>
          {BARCODE.map((opacity, i) => (
            <span
              key={i}
              className={styles.bar}
              style={{
                opacity,
                width: `${BAR_WIDTHS[i] ?? 1}px`,
              }}
            />
          ))}
        </div>

        <div className={styles.stamp}>
          ÆR IDEATION · SLOT 03 · BEKRÄFTAT
        </div>

        <div className={styles.divider} />

        <div className={styles.actions}>
          <button
            className={`${styles.payBtn} ${exported ? styles.payBtnDone : ''}`}
            onClick={handlePaydayExport}
            disabled={exported || exporting}
          >
            {exporting
              ? '···'
              : exported
              ? '✓ skickat till ær payday'
              : 'exportera till ær payday →'}
          </button>

          <div className={styles.navRow}>
            <button className={styles.navBtn} onClick={onBack}>← tillbaka</button>
            <button className={styles.navBtn} onClick={onReset}>× ny grej</button>
          </div>
        </div>

      </div>
    </div>
  )
}
