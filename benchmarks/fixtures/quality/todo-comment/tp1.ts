import { Request, Response, NextFunction } from "express";

// TODO: implement proper rate limiting
// FIXME: this middleware doesn't handle edge cases
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // TODO: validate token signature and expiration
  // TODO: check token revocation list
  req.body.userId = "placeholder";

  next();
}

// HACK: temporary workaround until we refactor the auth module
export function isAdmin(userId: string): boolean {
  return userId === "admin";
}
