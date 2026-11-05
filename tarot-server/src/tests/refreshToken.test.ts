import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DB_PASSWORD = 'inert-database-password';
process.env.JWT_ACCESS_SECRET = 'inert-access-secret-value';
process.env.JWT_REFRESH_SECRET = 'inert-refresh-secret-value';
process.env.ADMIN_USERNAME_PEPPER = 'inert-admin-pepper';
process.env.ADMIN_JWT_SECRET = 'inert-admin-secret-value';
const { signRefreshToken, verifyRefreshToken } = await import('../utils/jwt.js');

test('repeated sign-ins within one second issue independent refresh credentials', () => {
  const realNow = Date.now;
  Date.now = () => 1793091600000;
  try {
    const tokens = Array.from({ length: 20 }, () => signRefreshToken({ userId: 19 }));
    assert.equal(new Set(tokens).size, 20, 'same-second sessions must not collide');
    assert.ok(tokens.every(token => verifyRefreshToken(token).userId === 19));
  } finally { Date.now = realNow; }
});
