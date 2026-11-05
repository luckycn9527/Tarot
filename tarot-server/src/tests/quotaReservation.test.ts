import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { refundFailedReservation } from '../utils/quotaReservation.js';

function response() {
  return Object.assign(new EventEmitter(), { statusCode: 200, json(_body: unknown) { return this; } }) as unknown as Response;
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('failed JSON refunds after a browser disconnect, and finish does not refund twice', async () => {
  const res = response();
  let refunds = 0;
  refundFailedReservation(res, async () => { refunds++; }, error => assert.fail(String(error)));
  res.emit('close');
  res.statusCode = 502;
  res.json({ success: false });
  await settled();
  assert.equal(refunds, 1);
  res.emit('finish');
  await settled();
  assert.equal(refunds, 1);
});

test('a successful generation is charged even if the browser has disconnected', async () => {
  const res = response();
  let refunds = 0;
  refundFailedReservation(res, async () => { refunds++; }, error => assert.fail(String(error)));
  res.emit('close');
  res.json({ success: true });
  res.emit('finish');
  await settled();
  assert.equal(refunds, 0);
});

test('non-JSON failure responses are refunded on finish and errors are reported once', async () => {
  const res = response();
  const error = new Error('Simulated refund database outage');
  let reported: unknown;
  refundFailedReservation(res, async () => { throw error; }, value => { reported = value; });
  res.statusCode = 500;
  res.emit('finish');
  await settled();
  assert.equal(reported, error);
});
