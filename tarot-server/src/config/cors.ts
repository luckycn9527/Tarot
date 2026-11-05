import cors from 'cors';
import { env } from './env.js';

/** These are the bundled Capacitor app origins, never a substitute for bearer authentication. */
export const NATIVE_APP_ORIGINS = Object.freeze([
  'capacitor://localhost', 'http://localhost', 'https://localhost',
]);
const publicOrigins = new Set(env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean));

export function corsOptionsForOrigin(origin: string | undefined): cors.CorsOptions {
  const native = origin !== undefined && NATIVE_APP_ORIGINS.includes(origin);
  const allowed = origin !== undefined && (native || publicOrigins.has(origin));
  return {
    origin: allowed ? origin : false,
    credentials: allowed && !native,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Retry-After'],
  };
}

// Keep production CORS_ORIGIN validation unchanged; local native origins live in
// the explicit list above and do not add cookie access for a browser localhost.
export const corsOptions: cors.CorsOptionsDelegate = (req, callback) => {
  callback(null, corsOptionsForOrigin(req.headers.origin));
};
