import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.log(
      `[AUTH_MIDDLEWARE] Missing authorization token for route: ${req.originalUrl}`,
    );
    res.status(401).json({ error: true, payload: "unauthorized" });
    return;
  }
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY!,
    ) as JwtPayload;
    req.user = { username: decoded.username, id: decoded.id };
    console.log(
      `[AUTH_MIDDLEWARE] User ${req.user.username} successfully authorized for route: ${req.originalUrl}`,
    );

    next();
  } catch (error) {
    console.error(
      `[AUTH_MIDDLEWARE] Invalid token or verification failed for route: ${req.originalUrl}`,
      error,
    );
    res.status(401).json({ error: true, payload: "unauthorized" });
  }
}

export { authMiddleware };
