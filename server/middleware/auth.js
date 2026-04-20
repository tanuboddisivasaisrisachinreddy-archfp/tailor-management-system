import { resolveToken } from "../utils/auth.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = resolveToken(token);

  if (!session) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.sessionUser = session;
  req.authToken = token;
  next();
}
