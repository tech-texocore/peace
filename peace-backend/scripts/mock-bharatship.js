// Local mock of app.bharatship.com — mirrors the real response shapes so the
// courier integration can be tested end-to-end without a live account.
// Toggle failures with ?fail=auth|order|track via the MOCK_FAIL env var.
const http = require('http');

const FAIL = process.env.MOCK_FAIL || '';
let awbSeq = 153854853300000;

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    const path = req.url.split('?')[0];
    console.log(`HIT ${path}`);
    if (path === '/api/authToken') {
      if (FAIL === 'auth') return send(res, 401, { status: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      // JWT with a far-future exp so the token cache works
      const payload = Buffer.from(JSON.stringify({ sub: '72', exp: Math.floor(Date.now() / 1000) + 30 * 86400 })).toString('base64');
      return send(res, 200, { token: `mock.${payload}.sig` });
    }
    if (path === '/api/v1/create-order' || path === '/api/v1/create-reverse-order') {
      const order = JSON.parse(body || '{}');
      if (Number(order.courier_ship_type) === 1 && !order.courier_code) return send(res, 422, { status: false, message: 'Validation error', errors: { courier_code: ['Courier Code is required if courier_ship_type is 1.'] } });
      const weights = [].concat(order.weight ?? []);
      if (!weights.length || weights.some((w) => !(Number(w) > 0) || Number(w) > 50)) return send(res, 422, { status: false, message: 'Validation error', errors: { weight: [`Weight must be in kg (got ${weights.join(', ')})`] } });
    }
    if (path === '/api/v1/create-order') {
      if (FAIL === 'order') return send(res, 200, { status: false, message: 'Pincode not serviceable' });
      const waybill = String(++awbSeq);
      return send(res, 200, { status: true, order_id: 11557, waybill, message: 'Order Placed successfully by XpressBees', client_order_id: 0 });
    }
    if (path === '/api/v1/create-reverse-order') {
      const waybill = String(++awbSeq);
      return send(res, 200, { status: true, order_id: 11999, waybill, message: 'Reverse order created by Delhivery' });
    }
    if (path === '/api/v1/tracking-order') {
      if (FAIL === 'track') return send(res, 200, { status: false, message: 'AWB not found' });
      const code = Number(process.env.MOCK_TRACK_STATUS || 4);
      const titles = { 1: 'Booked', 4: 'In Transit', 5: 'Delivered', 7: 'RTO', 22: 'Out For Delivery' };
      const awb = JSON.parse(body || '{}').awb;
      return send(res, 200, {
        status: true, message: 'Success',
        data: {
          summary: { awb, payment_mode: 'PPD', express_type: 'surface', zone: 'A', shipment_status: code },
          history: [
            { shipment_status: code, tracking_date: '2026-08-21 09:10:00', location: 'Coimbatore', log_desc: null, awb, status_title: titles[code] ?? `Status ${code}` },
            { shipment_status: 1, tracking_date: '2026-08-19 18:05:00', location: null, log_desc: null, awb, status_title: 'Booked' },
          ],
        },
      });
    }
    if (path === '/api/v1/courier-list') {
      return send(res, 200, { status: true, data: [
        { courier_name: 'BlueDart', courier_code: 'blueDart' }, { courier_name: 'Delhivery', courier_code: 'delhivery' },
        { courier_name: 'DTDC', courier_code: 'dtdc' }, { courier_name: 'XpressBees', courier_code: 'Xpress' },
      ] });
    }
    if (path === '/api/v1/cancel-order') return send(res, 200, { status: true, message: 'Order cancelled' });
    return send(res, 404, { status: false, message: 'Not found' });
  });
});
const PORT = process.env.MOCK_PORT || 4100;
server.listen(PORT, () => console.log(`mock-bharatship listening on ${PORT} (FAIL=${FAIL || 'none'})`));
