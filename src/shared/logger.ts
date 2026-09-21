export function logInfo(fields: Record<string, unknown>): void {
  console.log({ city: "montreal", card: "cross-system", environment: "solution", ...fields });
}

export function logError(fields: Record<string, unknown>): void {
  console.error({ city: "montreal", card: "cross-system", environment: "solution", ...fields });
}
