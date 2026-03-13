import { Request, Response, NextFunction } from "express";
import { verifyToken, isTokenRevoked } from "../../../src/auth";
import { RateLimiter } from "../../../src/rate-limiter";

const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 100 });

// Authentication middleware that validates JWT tokens and enforces rate limits.
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (limiter.isRateLimited(req.ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = verifyToken(token);
  if (!payload || await isTokenRevoked(token)) {
    return res.status(403).json({ error: "Invalid or revoked token" });
  }

  req.body.userId = payload.sub;
  next();
}
