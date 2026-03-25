'use client'

import { useState } from 'react'
import type { IdeaNode } from '@/lib/types'
import styles from './Receipt.module.css'

const KIND_SE: Record<string, string> = {
  root: 'ursprung',
  mutation: 'mutation',
  symbiosis: 'symbios',
  parasite: 'parasit',
  adaptation: 'adaption',
  extinction: 'utrotning',
  emergence: 'emergens',
}

interface Props {
  path: IdeaNode[]
  thing: string
  onBack: () => void
  onReset: () => void
}

export default function Receipt({ path, thing, onBack, onReset }: Props) {
  const [exportState, setExportState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const timestamp = new Date()
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16)

  const derivationId = `AER-${Date.now().toString(36).toUpperCase()}`

  async function handleExportToPayday() {
    setExportState('sending')
    const payload = {
      derivationId,
      thing,
      path: path.map(n => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        description: n.description,
        depth: n.depth,
      })),
      timestamp: new Date().toISOString(),
      source: 'aer-ideation',
      status: 'pending',
    }
    // Persist locally so Payday can read when built
    try {
      const existing: unknown[] = JSON.parse(
        localStorage.getItem('aer:payday:inbox') ?? '[]'
      )
      existing.push(payload)
      localStorage.setItem('aer:payday:inbox', JSON.stringify(existing))
    } catch {}
    // POST to API stub (will be live when Payday is built)
    try {
      await fetch('/api/payday/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {}
    setExportState('done')
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.receipt}>

        <div className={styles.header}>
          <span className={styles.headerLabel}>H\u00c4RLEDD ID\u00c9V\u00c4G</span>
          <span className={styles.headerTs}>{timestamp}</span>
        </div>

        <div className={styles.chain}>
          {path.map((node, i) => {
            const isFinal = i === path.length - 1
            return (
              <div
                key={node.id}
                className={`${styles.step} ${isFinal ? styles.stepFinal : ''}`}
              >
                <div className={styles.stepLeft}>
                  <span className={styles.stepNum}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {!isFinal && <div className={styles.stepConnector} />}
                </div>
                <div className={styles.stepRight}>
                  <span className={styles.stepKind}>
                    {KIND_SE[node.kind] ?? node.kind}
                  </span>
                  <span className={styles.stepLabel}>{node.label}</span>
                  <span className={styles.stepDesc}>{node.description}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.seal}>
          <div className={styles.sealRule} />
          <span className={styles.sealText}>
            \u00c6R IDEATION \u00b7 {thing.toUpperCase()} \u00b7 {derivationId}
          </span>
          <div className={styles.sealRule} />
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.exportBtn} ${
              exportState === 'done' ? styles.exportBtnDone : ''
            }`}
            onClick={handleExportToPayday}
            disabled={exportState !== 'idle'}
          >
            {exportState === 'idle' && 'Exportera till \u00c6r Payday'}
            {exportState === 'sending' && '\u00b7\u00b7\u00b7'}
            {exportState === 'done' &&
              '\u2713 \u00d6verf\u00f6rt till \u00c6r Payday'}
            {exportState === 'error' && '\u00d7 Misslyckades'}
          </button>

          <div className={styles.secondaryActions}>
            <button className={styles.secondaryBtn} onClick={onBack}>
              \u2190 \u00e4ndra val
            </button>
            <span className={styles.secondaryDivider} />
            <button className={styles.secondaryBtn} onClick={onReset}>
              ny id\u00e9
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
