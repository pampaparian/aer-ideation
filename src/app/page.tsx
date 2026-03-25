'use client'

import { useState } from 'react'
import type { IdeaNode } from '@/lib/types'
import Receipt from '@/components/Receipt'
import styles from './page.module.css'

type Phase = 'input' | 'loading' | 'viewing' | 'splitting' | 'receipt'

interface HistoryStep {
  focusNode: IdeaNode
  children: IdeaNode[]
  selectedChild: IdeaNode
}

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
  const [phase, setPhase] = useState<Phase>('input')
  const [inputVal, setInputVal] = useState('')
  const [thing, setThing] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryStep[]>([])
  const [currentNode, setCurrentNode] = useState<IdeaNode | null>(null)
  const [children, setChildren] = useState<IdeaNode[] | null>(null)

  // Receipt is only available after navigating >=2 levels
  const canReceipt = history.length >= 2 && phase === 'viewing'
  const canGoBack = history.length > 0 || phase === 'receipt'

  // Derivation path for receipt: root + all selected children
  const derivationPath: IdeaNode[] =
    history.length > 0
      ? [history[0].focusNode, ...history.map(s => s.selectedChild)]
      : currentNode
      ? [currentNode]
      : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputVal.trim()
    if (!trimmed) return
    setThing(trimmed)
    setPhase('loading')
    setError(null)
    setHistory([])
    setCurrentNode(null)
    setChildren(null)
    try {
      const res = await fetch('/api/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thing: trimmed }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const root: IdeaNode = data.root
      setCurrentNode(root)
      // children stored at depth 1 inside root
      setChildren(root.children)
      setPhase('viewing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'okänt fel')
      setPhase('input')
    }
  }

  async function handleSelect(child: IdeaNode) {
    if (!currentNode || !children) return
    // Save current state to history before navigating
    const newStep: HistoryStep = {
      focusNode: currentNode,
      children,
      selectedChild: child,
    }
    setHistory(prev => [...prev, newStep])
    setCurrentNode(child)
    setChildren(null)
    setPhase('splitting')
    try {
      const res = await fetch('/api/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootThing: thing,
          parentId: child.id,
          parentLabel: child.label,
          parentKind: child.kind,
          parentDescription: child.description,
          depth: child.depth,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setChildren(data.children)
      setPhase('viewing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'klyvning misslyckades')
      setPhase('viewing')
    }
  }

  function handleBackTo(index: number) {
    const step = history[index]
    setCurrentNode(step.focusNode)
    setChildren(step.children)
    setHistory(prev => prev.slice(0, index))
    if (phase === 'receipt') setPhase('viewing')
  }

  function handleBack() {
    if (phase === 'receipt') {
      setPhase('viewing')
      return
    }
    if (history.length === 0) {
      setPhase('input')
      return
    }
    handleBackTo(history.length - 1)
  }

  function handleReset() {
    setPhase('input')
    setInputVal('')
    setThing('')
    setHistory([])
    setCurrentNode(null)
    setChildren(null)
    setError(null)
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.wordmark}>ÆR IDEATION</span>
          <span className={styles.slot}>slot 03</span>
        </div>
        <div className={styles.headerRight}>
          {canGoBack && (
            <button className={styles.navBtn} onClick={handleBack}>
              ← tillbaka
            </button>
          )}
          {phase !== 'input' && phase !== 'loading' && (
            <button className={styles.navBtn} onClick={handleReset}>
              × ny idé
            </button>
          )}
        </div>
      </header>

      {/* ── INPUT ── */}
      {phase === 'input' && (
        <div className={styles.inputStage}>
          <form onSubmit={handleSubmit}>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="grejen"
                autoFocus
              />
              <button
                className={styles.submitBtn}
                type="submit"
                disabled={!inputVal.trim()}
                aria-label="Skicka"
              >
                →
              </button>
            </div>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <div className={styles.centerStage}>
          <span className={styles.pulseDot} />
        </div>
      )}

      {/* ── VIEWING / SPLITTING ── */}
      {(phase === 'viewing' || phase === 'splitting') && currentNode && (
        <div className={styles.arena}>

          {/* Trail — clickable breadcrumb */}
          {history.length > 0 && (
            <div className={styles.trail}>
              {history.map((step, i) => (
                <button
                  key={step.focusNode.id}
                  className={styles.trailBtn}
                  onClick={() => handleBackTo(i)}
                >
                  {step.focusNode.label}
                  <span className={styles.trailSep}>→</span>
                </button>
              ))}
            </div>
          )}

          {/* Nucleus — re-keyed so animation replays on each navigation */}
          <div key={currentNode.id} className={styles.nucleus}>
            <span className={styles.nucleusKind}>
              {KIND_SE[currentNode.kind] ?? currentNode.kind}
            </span>
            <span className={styles.nucleusLabel}>{currentNode.label}</span>
            <span className={styles.nucleusDesc}>{currentNode.description}</span>
            {currentNode.depth > 0 && (
              <span className={styles.nucleusDepth}>djup {currentNode.depth}</span>
            )}
          </div>

          {/* Splitting indicator */}
          {phase === 'splitting' && (
            <div className={styles.splittingRow}>
              <span className={styles.splittingText}>klyver</span>
            </div>
          )}

          {/* Child nodes — 2-column grid */}
          {phase === 'viewing' && children && children.length > 0 && (
            <div className={styles.childGrid}>
              {children.map((child, i) => (
                <button
                  key={child.id}
                  className={styles.childNode}
                  style={{ animationDelay: `${i * 55}ms` }}
                  onClick={() => handleSelect(child)}
                >
                  <span className={styles.childKind}>
                    {KIND_SE[child.kind] ?? child.kind}
                  </span>
                  <span className={styles.childLabel}>{child.label}</span>
                  <span className={styles.childDesc}>{child.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* Receipt trigger — only after >=2 navigations */}
          {canReceipt && (
            <div className={styles.receiptRow}>
              <button
                className={styles.receiptBtn}
                onClick={() => setPhase('receipt')}
              >
                generera recept →
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── RECEIPT ── */}
      {phase === 'receipt' && (
        <Receipt
          path={derivationPath}
          thing={thing}
          onBack={handleBack}
          onReset={handleReset}
        />
      )}
    </main>
  )
}
