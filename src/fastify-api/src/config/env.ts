import { FastifyInstance } from "fastify";
import fastifyEnv from "@fastify/env";

/**
 * Type definition for application configuration
 */
export interface AppConfig {
  API_KEY: string;
  AWS_REGION: string;
  NODE_ENV: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_TIME_WINDOW: string;
}

/**
 * Environment configuration schema
 */
export const envSchema = {
  type: "object",
  required: ["API_KEY", "AWS_REGION"],
  properties: {
    API_KEY: { type: "string" },
    AWS_REGION: { type: "string" },
    NODE_ENV: {
      type: "string",
      default: "development",
      enum: ["development", "production", "test"],
    },
    CORS_ORIGIN: {
      type: "string",
      default: "*",
    },
    RATE_LIMIT_MAX: {
      type: "number",
      default: 100,
    },
    RATE_LIMIT_TIME_WINDOW: {
      type: "string",
      default: "1 minute",
    },
  },
} as const;

/**
 * Register environment configuration with the Fastify instance
 */
export async function registerEnvConfig(
  server: FastifyInstance,
): Promise<void> {
  await server.register(fastifyEnv, {
    confKey: "config",
    schema: envSchema,
    dotenv: true, // Load from .env file if available
  });
}

// Define configuration type
declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}
