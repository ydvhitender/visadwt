import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

let pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'wabuser',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'visadcouk_dataf',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    logger.info('MySQL pool created');
  }
  return pool;
}

export async function testMysqlConnection(): Promise<boolean> {
  try {
    const p = getMysqlPool();
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    logger.info('MySQL connected successfully');
    return true;
  } catch (err: any) {
    logger.error('MySQL connection failed:', err.message);
    return false;
  }
}
