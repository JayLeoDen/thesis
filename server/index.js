import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { baza } from './baza.js';
import { racun } from './racun.js';
import { planovi } from './planovi.js';
import { admin } from './admin.js';

var app = express();
var server = createServer(app);
var razvoj = process.argv.includes('--dev');
var port = Number(process.env.PORT || (razvoj ? 5173 : 3000));

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use('/api', function (req, res, dalje) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  if (!baza) return res.status(503).json({ kod: 'baza-nije-postavljena' });
  if (req.method !== 'GET' && req.method !== 'HEAD' && !req.is('application/json')) {
    return res.status(415).json({ kod: 'neispravan-format' });
  }
  dalje();
});

app.use('/api', express.json({ limit: '96kb' }));
app.use('/api/racun', racun);
app.use('/api/planovi', planovi);
app.use('/api/admin/korisnici/:korisnikId/planovi', planovi);
app.use('/api/admin', admin);
app.use('/api', function (req, res) { res.status(404).json({ kod: 'nepoznata-ruta' }); });
app.use('/api', function (greska, req, res, dalje) {
  if (res.headersSent) return dalje(greska);
  if (greska.status === 400 || greska.status === 413) {
    return res.status(greska.status).json({ kod: 'neispravan-format' });
  }
  console.error('Zahtjev nije uspio.', greska.code || greska.message);
  res.status(503).json({ kod: 'baza-nedostupna' });
});

if (razvoj) {
  var vite = await import('vite');
  var razvojniServer = await vite.createServer({
    server: { middlewareMode: true, hmr: { server: server } }
  });
  app.use(razvojniServer.middlewares);
} else {
  app.use(express.static(fileURLToPath(new URL('../dist/', import.meta.url))));
}

server.listen(port, process.env.HOST || (razvoj ? '127.0.0.1' : '0.0.0.0'), function () {
  console.log('Plan učenja: http://localhost:' + port);
});
