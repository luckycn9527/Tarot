import { createHash } from 'node:crypto';

export const CONFIG_SCOPES = ['card-backs', 'cards', 'readers-prompts', 'featured-readers'] as const;
export type ConfigScope = typeof CONFIG_SCOPES[number];
export type ConfigRow = Record<string, string | number | boolean | null>;
export interface ConfigVersion { revision: number; hash: string }
export interface ConfigMatch { expectedRevision: number; expectedHash: string; reason?: string }

const FIELDS: Record<ConfigScope, readonly string[]> = {
  'card-backs': ['id', 'code', 'name', 'description', 'assetUrl', 'isActive', 'accessType', 'price', 'sortOrder'],
  cards: ['id', 'name', 'nameEn', 'uprightKeywords', 'reversedKeywords', 'yesNoTendency', 'imageUrl', 'isActive'],
  'readers-prompts': ['readerCode', 'displayName', 'avatarUrl', 'emoji', 'accessLevel', 'systemPrompt', 'greeting'],
  'featured-readers': ['readerCode', 'isActive', 'sortOrder'],
};

function key(scope: ConfigScope, row: ConfigRow): string { return String(scope === 'card-backs' ? row.code : scope === 'cards' ? row.id : row.readerCode) }

/** Only business configuration fields enter snapshots; no tokens, users or timestamps. */
export function canonicalConfig(scope: ConfigScope, rows: ConfigRow[]): ConfigRow[] {
  return rows.map(row => Object.fromEntries(FIELDS[scope].map(field => [field, row[field] ?? null])) as ConfigRow)
    .sort((left, right) => key(scope, left).localeCompare(key(scope, right), 'en', { numeric: true }));
}

export function configHash(scope: ConfigScope, rows: ConfigRow[]): string {
  return createHash('sha256').update(JSON.stringify(canonicalConfig(scope, rows))).digest('hex');
}

export interface ConfigDifference {
  key: string;
  label: string;
  operation: 'added' | 'removed' | 'updated';
  fields: { field: string; before: ConfigRow[string]; after: ConfigRow[string] }[];
}

export function configDifferences(scope: ConfigScope, before: ConfigRow[], after: ConfigRow[]): ConfigDifference[] {
  const oldRows = new Map(canonicalConfig(scope, before).map(row => [key(scope, row), row]));
  const newRows = new Map(canonicalConfig(scope, after).map(row => [key(scope, row), row]));
  const differences: ConfigDifference[] = [];
  for (const id of [...new Set([...oldRows.keys(), ...newRows.keys()])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
    const oldRow = oldRows.get(id), newRow = newRows.get(id);
    const fields = FIELDS[scope].filter(field => oldRow?.[field] !== newRow?.[field])
      .map(field => ({ field, before: oldRow?.[field] ?? null, after: newRow?.[field] ?? null }));
    if (!fields.length) continue;
    const row = newRow ?? oldRow!;
    differences.push({ key: id, label: String(row.name ?? row.displayName ?? row.readerCode ?? row.code ?? id),
      operation: !oldRow ? 'added' : !newRow ? 'removed' : 'updated', fields });
  }
  return differences;
}
