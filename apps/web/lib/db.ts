import { Pool } from "pg";

// Pool partilhado. As migrations em packages/db-schema/migrations são a
// única fonte de verdade do esquema — este ficheiro só liga, não define nada.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}
