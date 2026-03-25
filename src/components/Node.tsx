import type { IdeaNode, NodeKind } from '@/lib/types'
import styles from './Node.module.css'

const KIND_LABELS: Record<NodeKind, string> = {
  root: 'ursprung',
  mutation: 'mutation',
  symbiosis: 'symbios',
  parasite: 'parasit',
  adaptation: 'adaption',
  extinction: 'utrotning',
  emergence: 'emergens',
}

interface Props {
  node: IdeaNode
}

export default function Node({ node }: Props) {
  return (
    <div className={`${styles.node} ${styles[node.kind]} ${styles[`depth${node.depth}`]}`}>
      <span className={styles.kind}>{KIND_LABELS[node.kind]}</span>
      <span className={styles.label}>{node.label}</span>
      <span className={styles.desc}>{node.description}</span>
    </div>
  )
}
