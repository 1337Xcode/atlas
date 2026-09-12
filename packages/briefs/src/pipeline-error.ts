/**
 * Three failure kinds the CLI reports differently: the operator passed something bad,
 * the environment is misconfigured, or a third party let us down. Collapsing them
 * hides which one you have to go fix.
 */

export class InvalidInputError extends Error {
  override readonly name = 'InvalidInputError'
}

export class ConfigurationError extends Error {
  override readonly name = 'ConfigurationError'
}

export class UpstreamServiceError extends Error {
  override readonly name = 'UpstreamServiceError'
  readonly service: string

  constructor(service: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.service = service
  }
}

export function exitCodeFor(error: unknown): number {
  if (error instanceof InvalidInputError) {
    return 2
  }
  if (error instanceof ConfigurationError) {
    return 78
  }
  if (error instanceof UpstreamServiceError) {
    return 69
  }
  return 1
}
