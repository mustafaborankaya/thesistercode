/**
 * MySQL bağlantı havuzu (mysql2/promise).
 * `mysql2.createPool` tembeldir (lazy): çağrıldığı anda gerçek bir bağlantı açmaz, yalnızca ilk
 * sorguda bağlanır. Bu sayede bu modül DB erişilemez olsa bile hatasız import edilebilir.
 */
import mysql from 'mysql2/promise'
import { env } from './env.js'

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60_000,
  queueLimit: 0,
  connectTimeout: 3000,
  charset: 'utf8mb4_unicode_ci',
  decimalNumbers: true,
  dateStrings: true,
})

/** /health uç noktası için hızlı bağlantı kontrolü — hata durumunda false döner, fırlatmaz. */
export async function pingDb() {
  try {
    const conn = await pool.getConnection()
    try {
      await conn.query('SELECT 1')
      return true
    } finally {
      conn.release()
    }
  } catch {
    return false
  }
}
