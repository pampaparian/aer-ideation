'use client'

import { useState } from 'react'
import IdeationCanvas from '@/components/IdeationCanvas'
import type { IdeaNode } from '@/lib/types'
import styles from './page.module.css'

export default function Home() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [root, setRoot] = useState<IdeaNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setRoot(null)
    try {
      const res = await fetch('/api/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thing: input }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRoot(data.root)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.wordmark}>ÆR IDEATION</span>
        <span className={styles.sub}>innovationsbiologi</span>
      </header>

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
            className={styles.button}
            type="submit"
            disabled={loading || !input.trim()}
          >
            {loading ? '···' : '→'}
          </button>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {root && <IdeationCanvas root={root} />}
    </main>
  )
}
