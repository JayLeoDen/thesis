import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { baza } from './baza.js';

var racun = Router();
var env = process.env;
var posta = /^https?:\/\//i.test(env.APP_URL || '') && env.SMTP_HOST && env.SMTP_FROM ? nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 587),
  secure: env.SMTP_SECURE === 'true',
  requireTLS: env.SMTP_SECURE !== 'true' && !process.argv.includes('--dev'),
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined
}) : null;
var izracunajKljuc = promisify(scrypt);
var nazivKolacica = 'plan_sesija';
var trajanjeSesije = 7 * 24 * 60 * 60 * 1000;
var cookieOpcije = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE !== 'false' && !process.argv.includes('--dev'),
  path: '/'
};
var ogranicenjePrijave = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { kod: 'previse-pokusaja' }
});
var ogranicenjeRegistracije = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { kod: 'previse-pokusaja' }
});

var ogranicenjeObnove = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { kod: 'previse-pokusaja' }
});

async function hashLozinke(lozinka) {
  var sol = randomBytes(16).toString('hex');
  var kljuc = await izracunajKljuc(lozinka, sol, 64);
  return sol + ':' + kljuc.toString('hex');
}

function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }

function tokenZahtjeva(req) {
  var vrijednost = (req.headers.cookie || '').split(';').map(function (dio) {
    return dio.trim();
  }).find(function (dio) { return dio.startsWith(nazivKolacica + '='); });
  var token = vrijednost?.slice(nazivKolacica.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}

function valjanaAdresa(vrijednost) {
  var email = typeof vrijednost === 'string' ? vrijednost.trim().toLowerCase() : '';
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email) ? email : null;
}

function podaciRacuna(req) {
  var email = valjanaAdresa(req.body?.email);
  var lozinka = req.body?.lozinka;
  if (!email || typeof lozinka !== 'string' || lozinka.length > 128) return null;
  return { email: email, lozinka: lozinka };
}

async function izradiSesiju(req, res, id, hash) {
  var token = randomBytes(32).toString('hex');
  var stariToken = tokenZahtjeva(req);
  await baza.query('DELETE FROM plan_ucenja_sesije WHERE vrijedi_do <= UTC_TIMESTAMP()');
  var zapis = await baza.query(
    `INSERT INTO plan_ucenja_sesije (token_hash, korisnik_id, vrijedi_do)
     SELECT ?, id, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY)
     FROM plan_ucenja_korisnici WHERE id = ? AND lozinka_hash = ?`,
    [hashToken(token), id, hash]
  );
  if (!zapis.affectedRows) return false;
  if (stariToken) await baza.query('DELETE FROM plan_ucenja_sesije WHERE token_hash = ?', [hashToken(stariToken)]);
  res.cookie(nazivKolacica, token, Object.assign({}, cookieOpcije, { maxAge: trajanjeSesije }));
  return true;
}

async function ucitajKorisnika(req, res, dalje) {
  var token = tokenZahtjeva(req);
  req.korisnik = null;
  if (token) {
    var redovi = await baza.query(
      'SELECT k.id, k.email, k.uloga FROM plan_ucenja_korisnici k JOIN plan_ucenja_sesije s ON s.korisnik_id = k.id WHERE s.token_hash = ? AND s.vrijedi_do > UTC_TIMESTAMP()',
      [hashToken(token)]
    );
    req.korisnik = redovi[0] || null;
  }
  dalje();
}

function traziPrijavu(req, res, dalje) {
  if (!req.korisnik || String(req.korisnik.id) !== req.get('X-Plan-Korisnik')) {
    return res.status(401).json({ kod: 'prijava-potrebna' });
  }
  dalje();
}

racun.get('/', ucitajKorisnika, async function (req, res) {
  if (!tokenZahtjeva(req)) await baza.query('SELECT 1');
  res.json({ korisnik: req.korisnik, obnovaDostupna: Boolean(posta) });
});

racun.post('/registracija', ogranicenjeRegistracije, async function (req, res) {
  var podaci = podaciRacuna(req);
  if (!podaci || podaci.lozinka.length < 8) return res.status(400).json({ kod: 'neispravni-podaci' });

  var hash = await hashLozinke(podaci.lozinka);
  var zapis;
  try {
    zapis = await baza.query('INSERT INTO plan_ucenja_korisnici (email, lozinka_hash) VALUES (?, ?)', [podaci.email, hash]);
  } catch (greska) {
    if (greska.code === 'ER_DUP_ENTRY') return res.status(409).json({ kod: 'racun-postoji' });
    throw greska;
  }
  var id = Number(zapis.insertId);
  if (!await izradiSesiju(req, res, id, hash)) return res.status(401).json({ kod: 'pogresna-prijava' });
  res.status(201).json({ id: id, email: podaci.email, uloga: 'korisnik' });
});

racun.post('/prijava', ogranicenjePrijave, async function (req, res) {
  var podaci = podaciRacuna(req);
  if (!podaci) return res.status(400).json({ kod: 'neispravni-podaci' });

  var redovi = await baza.query('SELECT id, email, uloga, lozinka_hash FROM plan_ucenja_korisnici WHERE email = ?', [podaci.email]);
  var korisnik = redovi[0];
  var [sol, hash] = korisnik ? korisnik.lozinka_hash.split(':') : ['00000000000000000000000000000000', '0'.repeat(128)];
  var kljuc = await izracunajKljuc(podaci.lozinka, sol, 64);
  if (!timingSafeEqual(kljuc, Buffer.from(hash, 'hex')) || !korisnik) {
    return res.status(401).json({ kod: 'pogresna-prijava' });
  }
  if (!await izradiSesiju(req, res, korisnik.id, korisnik.lozinka_hash)) {
    return res.status(401).json({ kod: 'pogresna-prijava' });
  }
  var [racun] = await baza.query('SELECT id, email, uloga FROM plan_ucenja_korisnici WHERE id = ?', [korisnik.id]);
  res.json(racun);
});

racun.post('/odjava', async function (req, res) {
  var token = tokenZahtjeva(req);
  if (token) await baza.query('DELETE FROM plan_ucenja_sesije WHERE token_hash = ?', [hashToken(token)]);
  res.clearCookie(nazivKolacica, cookieOpcije).sendStatus(204);
});

racun.post('/obnova', ogranicenjeObnove, async function (req, res) {
  if (!posta) return res.status(503).json({ kod: 'obnova-nedostupna' });
  var email = valjanaAdresa(req.body?.email);
  if (!email) return res.status(400).json({ kod: 'neispravni-podaci' });

  var redovi = await baza.query('SELECT id FROM plan_ucenja_korisnici WHERE email = ?', [email]);
  if (redovi.length) {
    var token = randomBytes(32).toString('hex');
    var url = new URL(env.APP_URL);
    url.hash = 'obnova=' + token;
    await baza.query(
      `INSERT INTO plan_ucenja_obnova_lozinke (korisnik_id, token_hash, vrijedi_do)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))
       ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), vrijedi_do = VALUES(vrijedi_do)`,
      [redovi[0].id, hashToken(token)]
    );
    posta.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: 'Obnova lozinke za Plan učenja',
      text: 'Poveznica za obnovu lozinke vrijedi 30 minuta.\n\n' + url.href
    }).catch(function (greska) {
      console.error('Slanje poruke za obnovu nije uspjelo.', greska.code || greska.name);
    });
  }
  res.sendStatus(204);
});

racun.post('/nova-lozinka', ogranicenjeObnove, async function (req, res) {
  var token = req.body?.token;
  var lozinka = req.body?.lozinka;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)
      || typeof lozinka !== 'string' || lozinka.length < 8 || lozinka.length > 128) {
    return res.status(400).json({ kod: 'neispravni-podaci' });
  }

  var hash = await hashLozinke(lozinka);
  var veza = await baza.getConnection();
  try {
    await veza.beginTransaction();
    var redovi = await veza.query(
      'SELECT korisnik_id FROM plan_ucenja_obnova_lozinke WHERE token_hash = ? AND vrijedi_do > UTC_TIMESTAMP() FOR UPDATE',
      [hashToken(token)]
    );
    if (!redovi.length) {
      await veza.rollback();
      return res.status(400).json({ kod: 'poveznica-istekla' });
    }
    var id = redovi[0].korisnik_id;
    await veza.query('UPDATE plan_ucenja_korisnici SET lozinka_hash = ? WHERE id = ?', [hash, id]);
    await veza.query('DELETE FROM plan_ucenja_obnova_lozinke WHERE korisnik_id = ?', [id]);
    await veza.query('DELETE FROM plan_ucenja_sesije WHERE korisnik_id = ?', [id]);
    await veza.commit();
    res.sendStatus(204);
  } catch (greska) {
    await veza.rollback();
    throw greska;
  } finally {
    veza.release();
  }
});

export { racun, traziPrijavu, ucitajKorisnika, hashLozinke, valjanaAdresa };
