import 'dotenv/config';

function need(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  port: parseInt(process.env.PORT || '8011', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mssql: {
    host: process.env.MSSQL_HOST || '10.0.0.110',
    port: parseInt(process.env.MSSQL_PORT || '1433', 10),
    user: process.env.MSSQL_USER || 'sa',
    password: need('MSSQL_PASSWORD', 'ptrj@123'),
    database: process.env.MSSQL_DATABASE || 'RJ_FileManagement',
  },
  jwtSecret: process.env.JWT_SECRET || 'ptrj-rjfm-dev-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  storagePath: process.env.RJFM_STORAGE_PATH || 'D:/RJFM_Storage/uploads',
  maxFileMb: parseInt(process.env.RJFM_MAX_FILE_MB || '10', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  apiKey: process.env.RJFM_API_KEY || '',
} as const;
