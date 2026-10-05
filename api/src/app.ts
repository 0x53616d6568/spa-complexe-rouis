import express, { type Express } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middleware/clerkProxyMiddleware";

const app: Express = express();

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
}
app.set("trust proxy", trustProxyHops);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk's proxy streams raw responses, so it must be mounted before parsers.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const hasClerkKey = Boolean(process.env.CLERK_PUBLISHABLE_KEY || process.env.CLERK_SECRET_KEY);

if (hasClerkKey) {
  try {
    app.use(
      clerkMiddleware((request) => ({
        publishableKey: publishableKeyFromHost(
          getClerkProxyHost(request) ?? "",
          process.env.CLERK_PUBLISHABLE_KEY,
        ),
      })),
    );
  } catch (err) {
    logger.warn({ err }, "Could not initialize Clerk middleware");
  }
} else {
  // Public fallback when Clerk is not configured
  app.use((req, _res, next) => {
    (req as any).auth = { userId: null, sessionId: null, getToken: async () => null };
    next();
  });
}

app.use("/api", router);

// Global error handler to ensure JSON response instead of HTML error
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled server error");
  res.status(500).json({ error: err?.message || "Internal server error" });
});

export default app;
