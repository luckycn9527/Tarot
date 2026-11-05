import assert from 'node:assert/strict';
import test from 'node:test';

// env.ts validates at module load. Tests use inert values and never connect to
// production services or a database.
process.env.NODE_ENV = 'test';
process.env.DB_PASSWORD = 'test-database-password';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-value';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-value';
process.env.ADMIN_USERNAME_PEPPER = 'test-admin-username-pepper';
process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret-value';
process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';

const { createPaymentRouter } = await import('../routes/payment.routes.js');

interface RouterLayer {
  route?: { path?: string };
}

function routePaths(paymentsEnabled: boolean): string[] {
  const router = createPaymentRouter(paymentsEnabled) as unknown as { stack: RouterLayer[] };
  return router.stack
    .map((layer) => layer.route?.path)
    .filter((path): path is string => typeof path === 'string')
    .sort();
}

test('disabled payments expose only the public plan capability probe', () => {
  assert.deepEqual(routePaths(false), ['/plans']);
});

test('enabled payments expose checkout, subscription, order and webhook routes', () => {
  assert.deepEqual(routePaths(true), [
    '/checkout',
    '/orders/:orderId',
    '/plans',
    '/subscription',
    '/subscription/cancel',
    '/webhook',
  ]);
});
