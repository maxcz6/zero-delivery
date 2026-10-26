import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getEnv } from "@/shared/env";

let clientSingleton: postgres.Sql | null = null;
let dbSingleton: PostgresJsDatabase<typeof schema> | null = null;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!dbSingleton) {
    const env = getEnv();
    clientSingleton = postgres(env.DATABASE_URL, {
      max: 10,
      connection: {
        TimeZone: "UTC",
      },
    });
    dbSingleton = drizzle(clientSingleton, { schema });
  }
  return dbSingleton;
}

export type DbClient = PostgresJsDatabase<typeof schema>;
export { schema };
