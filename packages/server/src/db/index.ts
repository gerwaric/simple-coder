import postgres from "postgres";

export const sql = postgres({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || "simple_coder",
  password: process.env.POSTGRES_PASSWORD || "simple_coder",
  database: process.env.POSTGRES_DB || "simple_coder",
});
