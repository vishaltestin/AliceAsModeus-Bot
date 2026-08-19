export class AppConfigurationError extends Error {
  readonly code = "APP_CONFIGURATION_ERROR"

  constructor(
    public readonly variable: string,
    message?: string
  ) {
    super(
      message ??
        `Missing required environment variable: ${variable}. Add it to .env before starting the application.`
    )
    this.name = "AppConfigurationError"
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new AppConfigurationError(name)
  return value
}

export function requireEncryptionKey(): string {
  const value = requireEnv("ENCRYPTION_KEY")
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new AppConfigurationError(
      "ENCRYPTION_KEY",
      "ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)."
    )
  }
  return value
}
