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

// Radial fan angles in degrees (0° = right horizontal)
function fanAngles(n: number): number[] {
  if (n <= 1) return [0]
  const spread = n === 2 ? 22 : n === 3 ? 30 : n === 4 ? 38 : 44
  return Array.from({ length: n }, (_, i) =>
    -spread + (i / (n - 1)) * spread * 2
  )
}

const RADIUS = 215 // px from nucleus edge to child label

function pause(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('input')
  const [inputVal, setInputVal] = useState('')
  const [thing, setThing] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryStep[]>([])
  const [currentNode, setCurrentNode] = useState<IdeaNode | null>(null)
  const [children, setChildren] = useState<IdeaNode[] | null>(null)
  const [exiting, setExiting] = useState(false)

  const canReceipt = history.length >= 2 && phase === 'viewing'
  const canGoBack = history.length > 0 || phase === 'receipt'

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
      setCurrentNode(data.root)
      setChildren(data.root.children)
      setPhase('viewing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'okänt fel')
      setPhase('input')
    }
  }

  async function handleSelect(child: IdeaNode) {
    if (!currentNode || !children || exiting) return
    // 1. Slide nucleus left + fade
    setExiting(true)
    await pause(210)
    // 2. Swap state (all batched in React 18)
    setExiting(false)
    setHistory(prev => [...prev, { focusNode: currentNode, children, selectedChild: child }])
    setCurrentNode(child)
    setChildren(null)
    setPhase('splitting')
    // 3. Fetch new children
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
    if (phase === 'receipt') { setPhase('viewing'); return }
    if (history.length === 0) { setPhase('input'); return }
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

  const angles = children ? fanAngles(children.length) : []

  return (
    <main className={styles.main}>

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.wordmark}>ÆR IDEATION</span>
          <span className={styles.slot}>slot 03</span>
        </div>
        <div className={styles.headerRight}>
          {canGoBack && (
            <button className={styles.navBtn} onClick={handleBack}>← tillbaka</button>
          )}
          {phase !== 'input' && phase !== 'loading' && (
            <button className={styles.navBtn} onClick={handleReset}>× ny idé</button>
          )}
        </div>
      </header>

      {/* ─ INPUT ─ */}
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
              <button className={styles.submitBtn} type="submit" disabled={!inputVal.trim()}>
                →
              </button>
            </div>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {/* ─ LOADING ─ */}
      {phase === 'loading' && (
        <div className={styles.centerStage}>
          <span className={styles.pulseDot} />
        </div>
      )}

      {/* ─ SPATIAL VIEW ─ */}
      {(phase === 'viewing' || phase === 'splitting') && currentNode && (
        <div className={styles.arena}>

          {/* Clickable trail — faded, physically represents the path leftwards */}
          {history.length > 0 && (
            <nav className={styles.trail} aria-label="Tankekedja">
              {history.map((step, i) => (
                <span key={step.focusNode.id} className={styles.trailItem}>
                  <button
                    className={styles.trailBtn}
                    onClick={() => handleBackTo(i)}
                    title={`Gå tillbaka till \u201c${step.focusNode.label}\u201d`}
                  >
                    {step.focusNode.label}
                  </button>
                  <span className={styles.trailSep} aria-hidden>→</span>
                </span>
              ))}
            </nav>
          )}

          {/* Horizontal node row */}
          <div className={styles.nodeRow}>

            {/* NUCLEUS — re-keyed so nucleusIn triggers on each new node */}
            <div
              key={currentNode.id}
              className={`${styles.nucleus} ${exiting ? styles.nucleusExiting : ''}`}
            >
              <span className={styles.nucleusKind}>
                {KIND_SE[currentNode.kind] ?? currentNode.kind}
              </span>
              <span className={styles.nucleusLabel}>{currentNode.label}</span>
              <span className={styles.nucleusDesc}>{currentNode.description}</span>
            </div>

            {/* Stem hairline */}
            {(children !== null || phase === 'splitting') && (
              <div className={styles.stemRight} />
            )}

            {/* Splitting indicator */}
            {phase === 'splitting' && (
              <span className={styles.splittingText}>klyver</span>
            )}

            {/* RADIAL CHILDREN */}
            {phase === 'viewing' && children && children.length > 0 && (
              <div className={styles.radialHost}>

                {/* 0.25px hairlines via SVG */}
                <svg
                  width={0}
                  height={0}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    overflow: 'visible',
                    pointerEvents: 'none',
                  }}
                >
                  {angles.map((deg, i) => {
                    const rad = (deg * Math.PI) / 180
                    const x2 = RADIUS * Math.cos(rad)
                    const y2 = RADIUS * Math.sin(rad)
                    return (
                      <line
                        key={i}
                        x1={0} y1={0}
                        x2={x2} y2={y2}
                        stroke="rgba(0,0,0,0.16)"
                        strokeWidth="0.25"
                      />
                    )
                  })}
                </svg>

                {/* Child node buttons — radially positioned */}
                {children.map((child, i) => {
                  const rad = (angles[i] * Math.PI) / 180
                  const x = RADIUS * Math.cos(rad)
                  const y = RADIUS * Math.sin(rad)
                  return (
                    <button
                      key={child.id}
                      className={styles.childNode}
                      style={{
                        transform: `translate(${x}px, calc(${y}px - 50%))`,
                        animationDelay: `${i * 60}ms`,
                      }}
                      onClick={() => handleSelect(child)}
                    >
                      <span className={styles.childKind}>
                        {KIND_SE[child.kind] ?? child.kind}
                      </span>
                      <span className={styles.childLabel}>{child.label}</span>
                      <span className={styles.childDesc}>{child.description}</span>
                    </button>
                  )
                })}

              </div>
            )}

          </div>{/* /nodeRow */}

          {/* Receipt trigger — unlocked at depth ≥2 */}
          {canReceipt && (
            <div className={styles.receiptRow}>
              <button className={styles.receiptBtn} onClick={() => setPhase('receipt')}>
                generera recept →
              </button>
            </div>
          )}

        </div>
      )}

      {/* ─ RECEIPT ─ */}
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
