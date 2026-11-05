export type ConfigScope = 'card-backs' | 'cards' | 'readers-prompts' | 'featured-readers'
export interface ConfigVersion { revision: number; hash: string }
export interface ConfigDifference {
  key: string
  label: string
  operation: 'added' | 'removed' | 'updated'
  fields: { field: string; before: string | number | boolean | null; after: string | number | boolean | null }[]
}
export interface ConfigHistoryEntry {
  id: number
  scope: ConfigScope
  revision: number
  action: 'baseline' | 'save' | 'delete' | 'rollback'
  operatorName: string
  reason: string | null
  rollbackTargetId: number | null
  changeCount: number
  createdAt: string
}
export interface ConfigHistoryDetail extends ConfigHistoryEntry { changes: ConfigDifference[] }
export interface ConfigRollbackPreview {
  target: ConfigHistoryEntry
  configVersion: ConfigVersion
  changes: ConfigDifference[]
  blockers: { id: number; name: string; code: string; reason: string }[]
}
