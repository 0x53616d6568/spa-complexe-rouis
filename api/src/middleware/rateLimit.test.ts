import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createRateLimiter } from "./rateLimit";

test("rate limiter rejects requests over the fixed-window limit", () => {
  const limiter = createRateLimiter({
    limit: 1,
    windowMs: 60_000,
    message: "Slow down.",
  });
  let statusCode = 200;
  let payload: unknown;
  let nextCalls = 0;
  const headers = new Map<string, number | string>();
  const request = {
    ip: "192.0.2.1",
    socket: { remoteAddress: "192.0.2.1" },
  } as Request;
  const response = {
    setHeader(name: string, value: number | string) {
      headers.set(name, value);
      return this;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  const next = (() => {
    nextCalls += 1;
  }) as NextFunction;

  limiter(request, response, next);
  assert.equal(nextCalls, 1);
  assert.equal(headers.get("RateLimit-Remaining"), 0);

  limiter(request, response, next);
  assert.equal(nextCalls, 1);
  assert.equal(statusCode, 429);
  assert.deepEqual(payload, { error: "Slow down." });
  assert.equal(headers.get("Retry-After"), 60);
});
