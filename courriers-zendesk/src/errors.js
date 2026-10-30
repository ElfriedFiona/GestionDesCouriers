class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function errorMiddleware(err, req, res, next) {
  const status = err.status || 500;
  // Erreurs venant de Zendesk (>=500 ou réseau) => 502
  const out = status >= 500 && err.fromZendesk ? 502 : status;
  if (out >= 500) console.error(err);
  res.status(out).json({ erreur: err.message || 'Erreur interne', details: err.details });
}
module.exports = { HttpError, asyncH, errorMiddleware };
