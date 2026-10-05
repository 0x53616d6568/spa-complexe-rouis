import type { Request, Response } from "express";
import { logger } from "../../lib/logger";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function sendRouteError(
  request: Request,
  response: Response,
  error: unknown,
): void {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  request.log?.error({ error }, "API request failed");
  logger.error({ error, path: request.path, method: request.method }, "API request failed");
  response.status(500).json({ error: "The request could not be completed." });
}