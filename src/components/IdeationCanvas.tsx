'use client'

import type { IdeaNode } from '@/lib/types'
import Node from './Node'
import styles from './IdeationCanvas.module.css'

interface Props {
  root: IdeaNode
}

export default function IdeationCanvas({ root }: Props) {
  return (
    <div className={styles.canvas}>
      <div className={styles.rootRow}>
        <Node node={root} />
      </div>
      <div className={styles.branches}>
        {root.children.map(child => (
          <div key={child.id} className={styles.branch}>
            <div className={styles.branchLine} />
            <Node node={child} />
            {child.children.length > 0 && (
              <div className={styles.subBranches}>
                {child.children.map(sub => (
                  <div key={sub.id} className={styles.subBranch}>
                    <div className={styles.subLine} />
                    <Node node={sub} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
