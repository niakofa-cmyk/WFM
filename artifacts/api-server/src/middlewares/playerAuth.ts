import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requirePlayerAuth: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "authentication_required" });
    return;
  }
  next();
};

export function playerIdFromRequest(req: Parameters<typeof getAuth>[0]): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated player ID is unavailable.");
  return userId;
}
