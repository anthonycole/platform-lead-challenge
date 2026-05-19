import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  base: { service: "kic-platform" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["payload.email", "payload.phone", "*.email", "*.phone"],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
