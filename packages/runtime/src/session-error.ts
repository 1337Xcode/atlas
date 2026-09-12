// docs: https://docs.reactor.inc/sdk-reference/types#reactorerror
export function describeSessionError(cause: unknown): string {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : 'The world could not connect.'
  const reported =
    typeof cause === 'object' && cause !== null && 'status' in cause ? cause.status : undefined
  const status =
    typeof reported === 'number' ? reported : Number(message.match(/\b(401|402|403|429)\b/)?.[1])

  // fix: the observed 429 is provider capacity, not an invalid key or exhausted credits
  if (status === 429 && /no available (capacity|servers)/i.test(message)) {
    return 'Reactor has no free servers for this model right now. No world started. Try again shortly.'
  }
  if (status === 429)
    return 'Reactor reached a session limit. Close other worlds and wait before trying again.'
  if (status === 401)
    return 'Reactor rejected the authorization. Try opening a new world; if it persists, check the server API key.'
  if (status === 402)
    return 'Reactor reports insufficient credits or a billing cap. Check the account before trying again.'
  if (status === 403)
    return 'Reactor denied permission for this model or session. Check model access on the account.'
  return message
}
