import crypto from "crypto";

const sessions = new Map();

export function createToken(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    userId: String(user._id),
    fullName: user.fullName,
    username: user.username,
  });
  return token;
}

export function resolveToken(token) {
  return sessions.get(token) || null;
}

export function clearToken(token) {
  sessions.delete(token);
}
