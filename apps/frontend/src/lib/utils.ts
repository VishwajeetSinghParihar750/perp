/** Coerce a wire value (which may arrive as a numeric string) to a number. */
export function toNumber(value: string | number): number {
  return typeof value === "number" ? value : parseFloat(value);
}

/** Promise that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
