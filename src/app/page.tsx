'use client'

import { useState } from 'react'
import type { IdeaNode } from '@/lib/types'
import Receipt from '@/components/Receipt'
import styles from './page.module.css'

type Phase = 'input' | 'loading' | 'exploring' | 'receipt'

const KIND_SE: Record<string, string> = {
  root: 'ursprung',
  mutation: 'mutation',
  symbiosis: 'symbios',
  parasite: 'parasit',
  adaptation: 'adaption',
  extinction: 'utrotning',
  emergence: 'emergens',
}

export default function Home() {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [error, setError] = useState<string | null>(null)
  const [root, setRoot] = useState<IdeaNode | null>(null)
  const [focusStack, setFocusStack] = useState<IdeaNode[]>([])
  const [selectedLeaf, setSelectedLeaf] = useState<IdeaNode | null>(null)

  const focus = focusStack.length > 0 ? focusStack[focusStack.length - 1] : root
  const canGoBack = phase === 'receipt' || focusStack.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch('/api/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thing: input }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRoot(data.root)
      setFocusStack([])
      setSelectedLeaf(null)
      setPhase('exploring')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ok\u00e4nt fel')
      setPhase('input')
    }
  }

  function handleSelect(node: IdeaNode) {
    if (node.children.length === 0) {
      setSelectedLeaf(node)
      setPhase('receipt')
      return
    }
    setFocusStack(prev => [...prev, node])
  }

  function handleBack() {
    if (phase === 'receipt') {
      setSelectedLeaf(null)
      setPhase('exploring')
      return
    }
    setFocusStack(prev => prev.slice(0, -1))
  }

  function handleReset() {
    setPhase('input')
    setInput('')
    setRoot(null)
    setFocusStack([])
    setSelectedLeaf(null)
    setError(null)
  }

  const derivationPath: IdeaNode[] = root
    ? [root, ...focusStack, ...(selectedLeaf ? [selectedLeaf] : [])]
    : []

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.wordmark}>\u00c6R IDEATION</span>
        <span className={styles.sub}>innovationsbiologi</span>
        {(phase === 'exploring' || phase === 'receipt') && (
          <span className={styles.headerActions}>
            {canGoBack && (
              <button className={styles.navBtn} onClick={handleBack}>
                \u2190 tillbaka
              </button>
            )}
            <button className={styles.navBtn} onClick={handleReset}>
              \u00d7 ny id\u00e9
            </button>
          </span>
        )}
      </header>

      {phase === 'input' && (
        <div className={styles.inputStage}>
          <form onSubmit={handleSubmit}>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="grejen"
                autoFocus
              />
              <button className={styles.submitBtn} type="submit" disabled={!input.trim()}>
                \u2192
              </button>
            </div>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {phase === 'loading' && (
        <div className={styles.loadingStage}>
          <span className={styles.loadingDots}>\u00b7\u00b7\u00b7</span>
        </div>
      )}

      {phase === 'exploring' && focus && (
        <div className={styles.exploringStage}>
          <div className={styles.focusCard}>
            <span className={styles.focusKind}>
              {KIND_SE[focus.kind] ?? focus.kind}
            </span>
            <span className={styles.focusLabel}>{focus.label}</span>
            <span className={styles.focusDesc}>{focus.description}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.branches}>
            {focus.children.map((child, i) => (
              <button
                key={child.id}
                className={styles.branch}
                onClick={() => handleSelect(child)}
              >
                <span className={styles.branchMeta}>
                  <span className={styles.branchNum}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.branchKind}>
                    {KIND_SE[child.kind] ?? child.kind}
                  </span>
                </span>
                <span className={styles.branchBody}>
                  <span className={styles.branchLabel}>{child.label}</span>
                  <span className={styles.branchDesc}>{child.description}</span>
                </span>
                <span className={styles.branchArrow}>\u2192</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'receipt' && (
        <Receipt
          path={derivationPath}
          thing={input}
          onBack={handleBack}
          onReset={handleReset}
        />
      )}
    </main>
  )
}
