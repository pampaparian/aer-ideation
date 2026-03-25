'use client'

import { useState } from 'react'
import type { IdeaNode } from '@/lib/types'
import BranchView from '@/components/BranchView'
import Receipt from '@/components/Receipt'
import styles from './page.module.css'

type Phase = 'input' | 'exploring' | 'receipt'

export default function Home() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [root, setRoot] = useState<IdeaNode | null>(null)
  const [path, setPath] = useState<IdeaNode[]>([])
  const [phase, setPhase] = useState<Phase>('input')
  const [error, setError] = useState<string | null>(null)

  const focus: IdeaNode | null = path.length > 0 ? path[path.length - 1] : root

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
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
      setPath([])
      setPhase('exploring')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'okänt fel')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectBranch(node: IdeaNode) {
    const newPath = [...path, node]
    setPath(newPath)
    if (node.children.length === 0) {
      setPhase('receipt')
    }
  }

  function handleBack() {
    if (phase === 'receipt') {
      setPhase('exploring')
      return
    }
    setPath(prev => prev.slice(0, -1))
    if (path.length === 0) setPhase('input')
  }

  function handleReset() {
    setPhase('input')
    setRoot(null)
    setPath([])
    setInput('')
    setError(null)
  }

  function handleGenerateReceipt() {
    setPhase('receipt')
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.wordmark}>ÆR IDEATION</span>
          <span className={styles.slot}>slot 03</span>
        </div>
        <div className={styles.headerRight}>
          {phase === 'exploring' && path.length > 0 && (
            <button className={styles.navBtn} onClick={handleBack}>← tillbaka</button>
          )}
          {phase === 'receipt' && (
            <button className={styles.navBtn} onClick={handleBack}>← tillbaka</button>
          )}
          {phase !== 'input' && (
            <button className={styles.navBtn} onClick={handleReset}>× ny grej</button>
          )}
        </div>
      </header>

      {phase === 'input' && (
        <div className={styles.inputPhase}>
          <p className={styles.intro}>ange grejen</p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="grejen"
                autoFocus
                disabled={loading}
              />
              <button
                className={styles.submitBtn}
                type="submit"
                disabled={loading || !input.trim()}
              >
                {loading ? '···' : '→'}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        </div>
      )}

      {phase === 'exploring' && root && focus && (
        <BranchView
          focus={focus}
          path={path}
          onSelect={handleSelectBranch}
          onReceipt={handleGenerateReceipt}
        />
      )}

      {phase === 'receipt' && root && (
        <Receipt
          root={root}
          path={path}
          thing={input}
          onBack={handleBack}
          onReset={handleReset}
        />
      )}
    </main>
  )
}
