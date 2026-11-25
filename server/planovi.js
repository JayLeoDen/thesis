import { Router } from 'express';
import { MODOVI, CILJEVI } from '../js/plan.js';
import { baza } from './baza.js';
import { traziPrijavu, ucitajKorisnika } from './racun.js';

var planovi = Router({ mergeParams: true });

function tekst(vrijednost, duljina) {
  return typeof vrijednost === 'string' && vrijednost.trim() && vrijednost.length <= duljina;
}

function valjanPlan(plan) {
  return plan && tekst(plan.naziv, 240) && tekst(plan.razlog, 300)
    && Object.hasOwn(MODOVI, plan.mod) && Object.hasOwn(CILJEVI, plan.cilj)
    && [10, 20, 35, 50].includes(plan.minute)
    && Array.isArray(plan.zadaci) && plan.zadaci.length >= 1 && plan.zadaci.length <= 10
    && plan.zadaci.every(function (zadatak) {
      return zadatak && tekst(zadatak.izvor, 100) && tekst(zadatak.uputa, 750) && tekst(zadatak.tekst, 750);
    })
    && Array.isArray(plan.dovrseni) && new Set(plan.dovrseni).size === plan.dovrseni.length
    && plan.dovrseni.every(function (i) { return Number.isInteger(i) && i >= 0 && i < plan.zadaci.length; });
}

planovi.use(ucitajKorisnika, traziPrijavu, function (req, res, dalje) {
  req.vlasnikPlana = req.korisnik.id;
  if (req.params.korisnikId !== undefined) {
    if (req.korisnik.uloga !== 'admin') return res.status(403).json({ kod: 'admin-potreban' });
    var id = Number(req.params.korisnikId);
    if (!/^[1-9][0-9]{0,9}$/.test(req.params.korisnikId) || id > 4294967295) {
      return res.status(400).json({ kod: 'neispravan-korisnik' });
    }
    req.vlasnikPlana = id;
  }
  dalje();
});
planovi.param('id', function (req, res, dalje, id) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) {
    return res.status(400).json({ kod: 'neispravan-plan' });
  }
  dalje();
});

planovi.get('/', async function (req, res) {
  var redovi = await baza.query(
    `SELECT p.id, p.naziv, p.nacin, p.cilj, p.minute, p.razlog, p.stvoren,
      k.redni_broj, k.izvor, k.uputa, k.tekst, k.dovrsen
     FROM plan_ucenja_planovi p JOIN plan_ucenja_koraci k ON k.plan_id = p.id
     WHERE p.korisnik_id = ?
     ORDER BY p.stvoren DESC, p.id, k.redni_broj`,
    [req.vlasnikPlana]
  );
  var rezultat = new Map();
  redovi.forEach(function (red) {
    if (!rezultat.has(red.id)) {
      rezultat.set(red.id, {
        id: red.id, naziv: red.naziv, mod: red.nacin, cilj: red.cilj, minute: red.minute,
        razlog: red.razlog, stvoren: red.stvoren, zadaci: [], dovrseni: []
      });
    }
    var plan = rezultat.get(red.id);
    plan.zadaci.push({ izvor: red.izvor, uputa: red.uputa, tekst: red.tekst });
    if (red.dovrsen) plan.dovrseni.push(red.redni_broj);
  });
  res.json(Array.from(rezultat.values()));
});

async function upisiKorake(veza, id, plan) {
  await veza.batch('INSERT INTO plan_ucenja_koraci (plan_id, redni_broj, izvor, uputa, tekst, dovrsen) VALUES (?, ?, ?, ?, ?, ?)',
    plan.zadaci.map(function (zadatak, i) {
      return [id, i, zadatak.izvor, zadatak.uputa, zadatak.tekst, plan.dovrseni.includes(i) ? 1 : 0];
    })
  );
}

planovi.put('/:id', async function (req, res) {
  var id = req.params.id;
  var plan = req.body;
  if (!valjanPlan(plan)) return res.status(400).json({ kod: 'neispravan-plan' });

  var veza = await baza.getConnection();
  try {
    await veza.beginTransaction();
    await veza.query(
      'INSERT INTO plan_ucenja_planovi (id, korisnik_id, naziv, nacin, cilj, minute, razlog, stvoren) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))',
      [id, req.vlasnikPlana, plan.naziv, plan.mod, plan.cilj, plan.minute, plan.razlog]
    );
    await upisiKorake(veza, id, plan);
    await veza.commit();
    res.sendStatus(204);
  } catch (greska) {
    await veza.rollback();
    if (greska.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ kod: 'korisnik-nije-pronadjen' });
    if (greska.code !== 'ER_DUP_ENTRY') throw greska;
    var postojeci = await veza.query('SELECT id FROM plan_ucenja_planovi WHERE id = ? AND korisnik_id = ?', [id, req.vlasnikPlana]);
    if (!postojeci.length) return res.status(404).json({ kod: 'plan-nije-pronadjen' });
    res.sendStatus(204);
  } finally {
    veza.release();
  }
});

planovi.patch('/:id', async function (req, res) {
  if (req.korisnik.uloga !== 'admin') return res.status(403).json({ kod: 'admin-potreban' });
  var id = req.params.id;
  var plan = req.body;
  if (!valjanPlan(plan)) return res.status(400).json({ kod: 'neispravan-plan' });

  var veza = await baza.getConnection();
  try {
    await veza.beginTransaction();
    var zapisi = await veza.query(
      'SELECT id FROM plan_ucenja_planovi WHERE id = ? AND korisnik_id = ? FOR UPDATE',
      [id, req.vlasnikPlana]
    );
    if (!zapisi.length) {
      await veza.rollback();
      return res.status(404).json({ kod: 'plan-nije-pronadjen' });
    }
    await veza.query(
      'UPDATE plan_ucenja_planovi SET naziv = ?, nacin = ?, cilj = ?, minute = ?, razlog = ? WHERE id = ?',
      [plan.naziv, plan.mod, plan.cilj, plan.minute, plan.razlog, id]
    );
    await veza.query('DELETE FROM plan_ucenja_koraci WHERE plan_id = ?', [id]);
    await upisiKorake(veza, id, plan);
    await veza.commit();
    res.sendStatus(204);
  } catch (greska) {
    await veza.rollback();
    throw greska;
  } finally {
    veza.release();
  }
});

planovi.patch('/:id/koraci/:indeks', async function (req, res) {
  if (!/^[0-9]$/.test(req.params.indeks)) return res.status(400).json({ kod: 'neispravan-korak' });

  var parametri = [req.params.id, Number(req.params.indeks), req.vlasnikPlana];
  var rezultat = await baza.query(
    `UPDATE plan_ucenja_koraci k JOIN plan_ucenja_planovi p ON p.id = k.plan_id
     SET k.dovrsen = 1 WHERE p.id = ? AND k.redni_broj = ? AND p.korisnik_id = ?`,
    parametri
  );
  if (!rezultat.affectedRows) return res.status(404).json({ kod: 'plan-nije-pronadjen' });
  res.sendStatus(204);
});

planovi.delete('/:id', async function (req, res) {
  var rezultat = await baza.query('DELETE FROM plan_ucenja_planovi WHERE id = ? AND korisnik_id = ?', [req.params.id, req.vlasnikPlana]);
  if (!rezultat.affectedRows) return res.status(404).json({ kod: 'plan-nije-pronadjen' });
  res.sendStatus(204);
});

export { planovi };
