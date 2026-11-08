import "server-only";
import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { unlink } from "node:fs/promises";
export type Row = Record<string, string | number | null>;
export type Db = mysql.Pool | PoolConnection;
export type SqlValue = string | number | boolean | null | Date | Buffer;
const singleton = globalThis as unknown as { runtimePool?: mysql.Pool };
export const pool =
  singleton.runtimePool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    namedPlaceholders: true,
    connectionLimit: 8,
  });
if (!singleton.runtimePool) {
  pool.on("connection", (c) => {
    c.query("SET time_zone = '+00:00'");
    c.query(
      "SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
    );
  });
  singleton.runtimePool = pool;
}
export async function rows(
  db: Db,
  sql: string,
  values: SqlValue[] | Record<string, SqlValue> = [],
): Promise<Row[]> {
  // Parameter escaping stays in mysql2. Avoid MariaDB's binary prepared-statement
  // path: this Windows installation crashed in Field::clone on the workspace JOIN.
  const [result] = await db.query<RowDataPacket[]>(sql, values);
  return result as Row[];
}
export async function one(
  db: Db,
  sql: string,
  values: SqlValue[] | Record<string, SqlValue> = [],
) {
  return (await rows(db, sql, values))[0];
}
export async function change(
  db: Db,
  sql: string,
  values: SqlValue[] | Record<string, SqlValue> = [],
) {
  const [result] = await db.query<mysql.ResultSetHeader>(sql, values);
  return result.affectedRows;
}
export interface Tx {
  db: PoolConnection;
  createdFiles: string[];
  removedFiles: string[];
}
export async function transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await pool.getConnection();
  const tx: Tx = { db, createdFiles: [], removedFiles: [] };
  let committing = false;
  try {
    await db.beginTransaction();
    const value = await fn(tx);
    committing = true;
    await db.commit();
    await Promise.all(tx.removedFiles.map((p) => unlink(p).catch(() => {})));
    return value;
  } catch (error) {
    await db.rollback().catch(() => {});
    if (!committing)
      await Promise.all(tx.createdFiles.map((p) => unlink(p).catch(() => {})));
    throw error;
  } finally {
    db.release();
  }
}
