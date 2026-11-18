function notFound(req, res, next) { const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`); error.status = 404; next(error); }
function errorHandler(error, req, res, next) {
  let status = error.status || 500;
  let message = error.message || 'Internal server error';
  let details;
  if (error.name === 'ValidationError') { status = 400; details = Object.values(error.errors).map((item) => item.message); message = 'Product validation failed'; }
  else if (error.name === 'CastError') { status = 400; message = 'Invalid product ID'; }
  else if (error.code === 11000) { status = 409; message = 'A product with this value already exists'; }
  res.status(status).json({ error: message, ...(details ? { details } : {}) });
}
module.exports = { notFound, errorHandler };
