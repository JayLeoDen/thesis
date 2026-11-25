async function zahtjev(putanja, metoda, podaci, korisnikId, signal) {
  var zaglavlja = {};
  if (metoda) zaglavlja['Content-Type'] = 'application/json';
  if (korisnikId) zaglavlja['X-Plan-Korisnik'] = korisnikId;

  var odgovor = await fetch('api/' + putanja, {
    method: metoda || 'GET',
    headers: zaglavlja,
    body: metoda ? JSON.stringify(podaci || {}) : undefined,
    signal: signal
  });
  if (!odgovor.ok) {
    var greska = await odgovor.json().catch(function () { return {}; });
    var poruka = new Error(greska.kod || 'veza-nedostupna');
    poruka.code = greska.kod;
    poruka.status = odgovor.status;
    throw poruka;
  }
  if (odgovor.status !== 204) return odgovor.json();
}

function trenutniRacun() { return zahtjev('racun'); }

function prijavi(email, lozinka) { return zahtjev('racun/prijava', 'POST', { email: email, lozinka: lozinka }); }
function registriraj(email, lozinka) { return zahtjev('racun/registracija', 'POST', { email: email, lozinka: lozinka }); }
function odjavi() { return zahtjev('racun/odjava', 'POST'); }
function posaljiObnovu(email) { return zahtjev('racun/obnova', 'POST', { email: email }); }
function postaviLozinku(token, lozinka) { return zahtjev('racun/nova-lozinka', 'POST', { token: token, lozinka: lozinka }); }

function pratiPlanove(korisnikId, prikazi, greska) {
  var zahtjevUTijeku;
  var zaustavljeno = false;
  var zadnjiPlanovi;

  async function ucitaj(osvjezi) {
    if (zaustavljeno || (zahtjevUTijeku && osvjezi !== true)) return;
    zahtjevUTijeku?.abort();
    var kontroler = new AbortController();
    zahtjevUTijeku = kontroler;
    try {
      var planovi = await zahtjev('planovi', null, null, korisnikId, kontroler.signal);
      var zapis = JSON.stringify(planovi);
      if (!kontroler.signal.aborted && zapis !== zadnjiPlanovi) {
        zadnjiPlanovi = zapis;
        prikazi(planovi);
      }
    } catch (problem) {
      if (!kontroler.signal.aborted) {
        zadnjiPlanovi = null;
        greska(problem);
      }
    } finally {
      if (zahtjevUTijeku === kontroler) zahtjevUTijeku = null;
    }
  }

  var interval = setInterval(function () { if (!document.hidden) ucitaj(); }, 5000);
  window.addEventListener('focus', ucitaj);
  ucitaj();
  return {
    ucitaj: ucitaj,
    zaustavi: function () {
      zaustavljeno = true;
      zahtjevUTijeku?.abort();
      clearInterval(interval);
      window.removeEventListener('focus', ucitaj);
    }
  };
}

function noviId() { return crypto.randomUUID(); }
function spremi(korisnikId, id, plan) { return zahtjev('planovi/' + id, 'PUT', plan, korisnikId); }
function dovrsi(korisnikId, id, indeks) { return zahtjev('planovi/' + id + '/koraci/' + indeks, 'PATCH', null, korisnikId); }
function ukloni(korisnikId, id) { return zahtjev('planovi/' + id, 'DELETE', null, korisnikId); }

export { zahtjev, trenutniRacun, prijavi, registriraj, odjavi, posaljiObnovu, postaviLozinku, pratiPlanove, noviId, spremi, dovrsi, ukloni };
