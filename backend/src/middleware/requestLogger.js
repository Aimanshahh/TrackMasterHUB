/**
 * Minimal structured request logging without an extra dependency.
 * Kept intentionally small so it can be swapped for a real logger later.
 */
export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = [
      new Date().toISOString(),
      req.method,
      req.originalUrl,
      res.statusCode,
      `${durationMs.toFixed(1)}ms`,
      req.id,
    ].join(' ');

    if (res.statusCode >= 500) {
      console.error(line);
    } else {
      console.info(line);
    }
  });

  next();
}
