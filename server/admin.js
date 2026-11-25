import { Router } from 'express';
import { baza } from './baza.js';
import { hashLozinke, traziPrijavu, ucitajKorisnika, valjanaAdresa } from './racun.js';

var admin = Router();

admin.use(ucitajKorisnika, traziPrijavu, function (req, res, dalje) {
  if (req.korisnik.uloga !== 'admin') return res.status(403).json({ kod: 'admin-potreban' });
  dalje();
});

admin.param('id', function (req, res, dalje, id) {
  if (!/^[1-9][0-9]{0,9}$/.test(id) || Number(id) > 4294967295) {
    return res.status(400).json({ kod: 'neispravan-korisnik' });
  }
  dalje();
});

function podaciRacuna(podaci, izrada) {
  var email = valjanaAdresa(podaci?.email);
  var uloga = podaci?.uloga;
  var lozinka = podaci?.lozinka;
  if (!email || !['korisnik', 'admin'].includes(uloga) || typeof lozinka !== 'string') return null;
  if ((izrada || lozinka) && (lozinka.length < 8 || lozinka.length > 128)) return null;
  return { email: email, uloga: uloga, lozinka: lozinka };
}

admin.get('/korisnici', async function (req, res) {
  res.json(await baza.query('SELECT id, email, uloga FROM plan_ucenja_korisnici ORDER BY email'));
});

admin.post('/korisnici', async function (req, res) {
  var podaci = podaciRacuna(req.body, true);
  if (!podaci) return res.status(400).json({ kod: 'neispravni-podaci' });

  try {
    await baza.query(
      'INSERT INTO plan_ucenja_korisnici (email, lozinka_hash, uloga) VALUES (?, ?, ?)',
      [podaci.email, await hashLozinke(podaci.lozinka), podaci.uloga]
    );
    res.sendStatus(204);
  } catch (greska) {
    if (greska.code === 'ER_DUP_ENTRY') return res.status(409).json({ kod: 'racun-postoji' });
    throw greska;
  }
});

async function izmijeniRacun(req, res, brisanje) {
  var id = Number(req.params.id);
  var podaci = brisanje ? null : podaciRacuna(req.body, false);
  if (!brisanje && !podaci) return res.status(400).json({ kod: 'neispravni-podaci' });

  var hash = podaci?.lozinka ? await hashLozinke(podaci.lozinka) : null;
  var veza = await baza.getConnection();
  try {
    await veza.beginTransaction();
    var redovi = await veza.query('SELECT id, email, uloga FROM plan_ucenja_korisnici ORDER BY id FOR UPDATE');
    var izvrsitelj = redovi.find(function (red) { return red.id === req.korisnik.id; });
    var zapis = redovi.find(function (red) { return red.id === id; });
    if (izvrsitelj?.uloga !== 'admin' || !zapis) {
      await veza.rollback();
      return res.status(zapis ? 403 : 404).json({ kod: zapis ? 'admin-potreban' : 'korisnik-nije-pronadjen' });
    }
    var brojAdmina = redovi.filter(function (red) { return red.uloga === 'admin'; }).length;
    if (zapis.uloga === 'admin' && brojAdmina === 1 && (brisanje || podaci.uloga !== 'admin')) {
      await veza.rollback();
      return res.status(409).json({ kod: 'zadnji-admin' });
    }
    if (brisanje) {
      await veza.query('DELETE FROM plan_ucenja_korisnici WHERE id = ?', [id]);
    } else {
      await veza.query(
        'UPDATE plan_ucenja_korisnici SET email = ?, uloga = ?, lozinka_hash = COALESCE(?, lozinka_hash) WHERE id = ?',
        [podaci.email, podaci.uloga, hash, id]
      );
      if (hash || zapis.email !== podaci.email) {
        await veza.query('DELETE FROM plan_ucenja_obnova_lozinke WHERE korisnik_id = ?', [id]);
      }
      if (hash || zapis.uloga !== podaci.uloga || zapis.email !== podaci.email) {
        await veza.query('DELETE FROM plan_ucenja_sesije WHERE korisnik_id = ?', [id]);
      }
    }
    await veza.commit();
    res.sendStatus(204);
  } catch (greska) {
    await veza.rollback();
    if (greska.code === 'ER_DUP_ENTRY') return res.status(409).json({ kod: 'racun-postoji' });
    throw greska;
  } finally {
    veza.release();
  }
}

admin.patch('/korisnici/:id', function (req, res) { return izmijeniRacun(req, res, false); });
admin.delete('/korisnici/:id', function (req, res) { return izmijeniRacun(req, res, true); });

export { admin };
