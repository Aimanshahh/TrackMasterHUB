export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    const method = req.method;
    const path = req.originalUrl;
    const status = res.statusCode;
    const userId = req.user?.id ?? '-';
    const session = req.cookies?.session ? 'cookie-present' : 'none';

    console.log('[trackmaster-hub-api] ' + method + ' ' + path + ' -> ' + status + ' ' + duration.toFixed(1) + 'ms userId=' + userId + ' session=' + session);
  });

  next();
};
