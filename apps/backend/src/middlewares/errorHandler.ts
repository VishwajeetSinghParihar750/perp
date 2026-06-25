import type { Request, Response, NextFunction } from "express";

function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(
    `[ERROR_HANDLER] Unhandled error on route ${req.originalUrl}:`,
    err,
  );

  if (res.headersSent) return next(err);

  // Provide a minimal, consistent error response
  res.status(err?.status || 500).json({
    error: true,
    message: err?.message || "internal server error",
  });
}

export { errorHandler };
