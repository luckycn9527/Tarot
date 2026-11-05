import type { Response } from 'express';

/** Observe the outcome before sending JSON: a disconnected browser may never
 * emit finish, but a failed generation must still refund its reservation. */
export function refundFailedReservation(res: Response, refund: () => Promise<void>, onError: (error: unknown) => void) {
  let refunded = false;
  const inspect = () => {
    if (res.statusCode < 400 || refunded) return;
    refunded = true;
    void Promise.resolve().then(refund).catch(onError);
  };
  const json = res.json;
  res.json = function (body) {
    inspect();
    return json.call(this, body);
  };
  res.once('finish', inspect);
}
