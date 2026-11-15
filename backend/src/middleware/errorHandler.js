/**
 * Central Error Handling Middleware
 * Ensures all errors are sanitized before returning to clients in production,
 * avoiding exposure of internal stack traces, database details, or credentials.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  // Specific handling for Multer file upload errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      message: "File size exceeds the 25MB limit",
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid ID format for parameter: ${err.path}`,
    });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      message: "Validation Error",
      errors: messages,
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: "Duplicate key conflict: resource already exists",
    });
  }

  // Safe fallback message
  const isProduction = process.env.NODE_ENV === "production";
  res.status(statusCode).json({
    message: isProduction && statusCode === 500 ? "Internal server error" : (err.message || "An unexpected error occurred"),
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

/**
 * 404 Route Handler
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    message: `Not Found: ${req.method} ${req.originalUrl}`,
  });
};
