import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins = (() => {
  const list = new Set<string>();
  if (process.env.REPLIT_DEV_DOMAIN) {
    list.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  if (process.env.REPLIT_DEPLOYMENT_DOMAIN) {
    list.add(`https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}`);
  }
  if (process.env.PUBLIC_APP_ORIGINS) {
    for (const o of process.env.PUBLIC_APP_ORIGINS.split(",")) {
      const t = o.trim();
      if (t) list.add(t);
    }
  }
  if (process.env.NODE_ENV !== "production") {
    list.add("http://localhost:5173");
    list.add("http://localhost:3000");
    list.add("http://localhost:80");
  }
  return list;
})();

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      cb(new Error(`Origin not allowed: ${origin}`));
    },
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
