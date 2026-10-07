// Minimal structured logger. Swap the sink for your hosting provider's log drain if needed.
type Level = "info" | "warn" | "error";

function serialise(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

function log(level: Level, message: string, data?: unknown) {
  const entry = { level, message, time: new Date().toISOString(), ...(data !== undefined ? { data: serialise(data) } : {}) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (process.env.NODE_ENV !== "test") console.info(line);
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
};
