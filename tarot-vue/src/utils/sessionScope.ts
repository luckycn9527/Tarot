// A monotonically increasing session generation also rejects responses from a
// previous login of the same account.
let owner: number | null = null
let generation = 0

export function getSessionScope() {
  return { owner, generation }
}

export function changeSessionScope(userId: number | null) {
  owner = userId
  generation += 1
}

export function isCurrentSession(scope: ReturnType<typeof getSessionScope>) {
  return scope.generation === generation && scope.owner === owner
}

export class SessionChangedError extends Error {
  constructor() {
    super('Session changed while the request was running')
    this.name = 'SessionChangedError'
  }
}
