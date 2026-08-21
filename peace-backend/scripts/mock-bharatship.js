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
      return send(res, 200, {
        status: true, current_status: 'In Transit', courier_name: 'XpressBees',
        tracking_data: [
          { status: 'Out for delivery', location: 'Coimbatore', date: '2026-08-21 09:10' },
          { status: 'In Transit', location: 'Salem Hub', date: '2026-08-20 22:40' },
          { status: 'Picked Up', location: 'Delhi Warehouse', date: '2026-08-19 18:05' },
        ],
      });
    }
    if (path === '/api/v1/cancel-order') return send(res, 200, { status: true, message: 'Order cancelled' });
    return send(res, 404, { status: false, message: 'Not found' });
  });
});
const PORT = process.env.MOCK_PORT || 4100;
server.listen(PORT, () => console.log(`mock-bharatship listening on ${PORT} (FAIL=${FAIL || 'none'})`));
