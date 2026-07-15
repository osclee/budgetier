import { HttpRequest, Cookie } from "@azure/functions";
import jwt from "jsonwebtoken";
import { JwtPayload } from "./types";

const COOKIE_NAME = "budgetier_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is not set or too short (need >= 16 chars).");
  }
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === "object" && decoded && "sub" in decoded) {
      return { sub: String(decoded.sub), username: String((decoded as any).username) };
    }
    return null;
  } catch {
    return null;
  }
}

function cookiesAreSecure(): boolean {
  // Local dev over http://localhost sets INSECURE_COOKIES=true so the browser
  // will actually store/send the cookie. Production defaults to secure.
  return process.env.INSECURE_COOKIES !== "true";
}

export function authCookie(token: string): Cookie {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: cookiesAreSecure(),
    sameSite: "Strict",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  };
}

export function clearAuthCookie(): Cookie {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: cookiesAreSecure(),
    sameSite: "Strict",
    path: "/",
    maxAge: 0,
  };
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export function getTokenFromRequest(request: HttpRequest): string | null {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[COOKIE_NAME] || null;
}

/**
 * Returns the authenticated user payload, or null if the request is unauthenticated.
 */
export function requireAuth(request: HttpRequest): JwtPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}
