export type NodeKind =
  | 'root'
  | 'mutation'
  | 'symbiosis'
  | 'parasite'
  | 'adaptation'
  | 'extinction'
  | 'emergence'

export interface IdeaNode {
  id: string
  label: string
  description: string
  kind: NodeKind
  depth: number
  parentId: string | null
  children: IdeaNode[]
}

export interface IdeationResponse {
  root: IdeaNode
}
