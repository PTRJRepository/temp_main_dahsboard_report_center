import sql from 'mssql';
import { env } from './env.js';

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return Promise.resolve(pool);
  if (poolPromise) return poolPromise;
  poolPromise = new sql.ConnectionPool({
    server: env.mssql.host,
    port: env.mssql.port,
    user: env.mssql.user,
    password: env.mssql.password,
    database: env.mssql.database,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 10, min: 1, idleTimeoutMillis: 30000 },
  })
    .connect()
    .then((p) => {
      pool = p;
      poolPromise = null;
      return p;
    })
    .catch((e) => {
      poolPromise = null;
      throw e;
    });
  return poolPromise;
}

export { sql };
