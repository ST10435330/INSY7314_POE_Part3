const path = require('node:path');

require('dotenv').config({ quiet: true });

const rootDir = path.resolve(__dirname, '..');

function requireSecureSecret() {
  const secret = process.env.JWT_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    secret.startsWith('replace-this')
  ) {
    throw new Error(
      'JWT_SECRET must contain at least 32 random characters.'
    );
  }

  return secret;
}

module.exports = {
  port: Number(process.env.PORT) || 3443,
  nodeEnv: process.env.NODE_ENV || 'development',

  mongodbUri: process.env.MONGODB_URI,

  jwtSecret: requireSecureSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtIssuer: process.env.JWT_ISSUER || 'hustlehub-plus-api',
  jwtAudience: process.env.JWT_AUDIENCE || 'hustlehub-plus-users',

  allowedOrigin:
    process.env.ALLOWED_ORIGIN || 'http://localhost:5173',

  certificatePath: path.join(rootDir, 'certs', 'localhost.crt'),
  privateKeyPath: path.join(rootDir, 'certs', 'localhost.key'),

};