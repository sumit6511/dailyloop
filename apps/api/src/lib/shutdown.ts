import type { FastifyInstance } from "fastify";

/**
 * On SIGTERM/SIGINT (a deploy or restart), stop accepting connections and let in-flight requests
 * finish — including a final move's completion transaction — before disconnecting from the
 * database and exiting. A deadline guarantees the process still exits if something hangs.
 */
export function registerGracefulShutdown(
  app: FastifyInstance,
  onClosed: () => Promise<void>,
  {
    timeoutMs = 10_000,
    exit = (code: number): void => process.exit(code),
  }: { timeoutMs?: number; exit?: (code: number) => void } = {},
): (signal: string) => Promise<void> {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} received — finishing in-flight requests before exiting`);
    const deadline = setTimeout(() => {
      app.log.error("Graceful shutdown timed out; exiting anyway");
      exit(1);
    }, timeoutMs);
    deadline.unref();
    try {
      await app.close();
      await onClosed();
      exit(0);
    } catch (error) {
      app.log.error(error);
      exit(1);
    } finally {
      clearTimeout(deadline);
    }
  };
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, () => void shutdown(signal));
  return shutdown;
}
