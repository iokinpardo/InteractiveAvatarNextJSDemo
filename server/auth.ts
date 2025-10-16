import type { Role } from "./types";

import { randomUUID } from "crypto";

import jwt from "jsonwebtoken";

export interface TokenClaims {
  role: Role;
  session: string;
  exp: number;
  jti?: string;
}

const DEFAULT_EXPIRATION = "10m";

type SignOptions = Partial<jwt.SignOptions> & { expiresIn?: string | number };

function requireSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  return secret;
}

export function signToken(
  payload: Omit<TokenClaims, "exp">,
  options: SignOptions = {},
): string {
  const { expiresIn = DEFAULT_EXPIRATION, ...rest } = options;

  return jwt.sign(
    { ...payload, jti: payload.jti ?? randomUUID() },
    requireSecret(),
    {
      expiresIn,
      ...rest,
    },
  );
}

export function verifyToken(token?: string): TokenClaims | null {
  if (!token) return null;
  try {
    return jwt.verify(token, requireSecret()) as TokenClaims;
  } catch {
    return null;
  }
}
