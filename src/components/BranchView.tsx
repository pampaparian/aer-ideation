'use client'

import type { IdeaNode } from '@/lib/types'
import styles from './BranchView.module.css'

const KIND_LABELS: Record<string, string> = {
  root: 'ursprung',
  mutation: 'mutation',
  symbiosis: 'symbios',
  parasite: 'parasit',
  adaptation: 'adaption',
  extinction: 'utrotning',
  emergence: 'emergens',
}

interface Props {
  focus: IdeaNode
  path: IdeaNode[]
  onSelect: (node: IdeaNode) => void
  onReceipt: () => void
}

export default function BranchView({ focus, path, onSelect, onReceipt }: Props) {
  return (
    <div className={styles.view}>

      {path.length > 0 && (
        <div className={styles.breadcrumb}>
          {path.map((node, i) => (
            <span key={node.id} className={styles.crumbItem}>
              {i > 0 && <span className={styles.crumbArrow}>→</span>}
              <span className={styles.crumb}>{node.label}</span>
            </span>
          ))}
        </div>
      )}

      <div className={styles.central}>
        <span className={styles.centralKind}>{KIND_LABELS[focus.kind]}</span>
        <span className={styles.centralLabel}>{focus.label}</span>
        <span className={styles.centralDesc}>{focus.description}</span>
      </div>

      {focus.children.length > 0 && (
        <div className={styles.branches}>
          <span className={styles.branchesLabel}>välj gren</span>
          <div className={styles.branchesList}>
            {focus.children.map(child => (
              <button
                key={child.id}
                className={`${styles.branch} ${styles[child.kind]}`}
                onClick={() => onSelect(child)}
              >
                <span className={styles.branchKind}>{KIND_LABELS[child.kind]}</span>
                <span className={styles.branchLabel}>{child.label}</span>
                <span className={styles.branchDesc}>{child.description}</span>
                <span className={styles.branchCaret}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {path.length >= 1 && (
        <div className={styles.receiptRow}>
          <button className={styles.receiptBtn} onClick={onReceipt}>
            generera recept →
          </button>
        </div>
      )}
    </div>
  )
}
