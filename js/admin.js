import { zahtjev, trenutniRacun, noviId } from './baza.js';
import { MODOVI, CILJEVI } from './plan.js';

var el = {};
document.querySelectorAll('[id^="admin-"]').forEach(function (element) {
  el[element.id.slice(6)] = element;
});

var administrator;
var promijeniRacun;
var korisnici = [];
var planovi = [];
var zauzeto = false;
var generacija = 0;
var korisnikId;
var planId;

function poruka(tekst) { el.poruka.textContent = tekst; }
function polja(form) { return Object.fromEntries(new FormData(form)); }
function opcije(select, redovi, prazno) {
  select.replaceChildren();
  if (prazno) select.append(new Option(prazno, ''));
  redovi.forEach(function (red) { select.append(new Option(red[1], red[0])); });
}

opcije(el.plan.elements.mod, Object.entries(MODOVI).map(function ([id, mod]) { return [id, mod.naziv]; }));
opcije(el.plan.elements.cilj, Object.entries(CILJEVI));
opcije(el.plan.elements.minute, [10, 20, 35, 50].map(function (minute) { return [minute, minute]; }));

function postaviAdministratora(racun, osvjezi) {
  var id = racun?.uloga === 'admin' ? racun.id : null;
  promijeniRacun = osvjezi;
  if (id === administrator) return;
  administrator = id;
  generacija++;
  zauzeto = false;
  el.panel.inert = false;
  korisnici = [];
  planovi = [];
  el.korisnici.replaceChildren();
  el.planovi.replaceChildren();
  el.racun.reset();
  el.plan.reset();
  el.koraci.replaceChildren();
  el['planovi-stupac'].hidden = true;
  el.plan.hidden = true;
  el.panel.hidden = true;
  el.gumb.hidden = !administrator;
  poruka('');
}

function rutaPlanova() { return 'admin/korisnici/' + korisnikId + '/planovi'; }
function zatrazi(ruta, metoda, podaci) { return zahtjev(ruta, metoda, podaci, administrator); }

async function izvrsi(radnja) {
  if (zauzeto || !administrator) return;
  var stanje = generacija;
  var aktualno = function () { return stanje === generacija; };
  zauzeto = true;
  el.panel.inert = true;
  poruka('Učitavam…');
  try {
    var obavijest = await radnja(aktualno);
    if (aktualno()) poruka(obavijest || '');
  } catch (greska) {
    if (!aktualno()) return;
    var poruke = {
      'zadnji-admin': 'Mora ostati barem jedan administrator.',
      'racun-postoji': 'E-adresa je već u upotrebi.',
      'neispravni-podaci': 'Provjeri e-adresu, ulogu i lozinku.',
      'neispravan-plan': 'Popuni podatke plana i unesi između jednog i deset potpunih koraka.',
      'plan-nije-pronadjen': 'Plan više nije dostupan.',
      'korisnik-nije-pronadjen': 'Korisnički račun više nije dostupan.'
    };
    if ([401, 403].includes(greska.status)) {
      var odgovor = await trenutniRacun().catch(function () { return { korisnik: null }; });
      if (aktualno()) promijeniRacun(odgovor.korisnik);
    } else {
      poruka(poruke[greska.code] || 'Promjena nije uspjela. Pokušaj ponovno.');
    }
  } finally {
    if (aktualno()) {
      zauzeto = false;
      el.panel.inert = false;
    }
  }
}

async function prikaziKorisnika(id, aktualno) {
  korisnikId = id;
  el.korisnici.value = id || '';
  var korisnik = korisnici.find(function (red) { return red.id === id; });
  el.racun.reset();
  el.racun.elements.email.value = korisnik?.email || '';
  el.racun.elements.uloga.value = korisnik?.uloga || 'korisnik';
  el.racun.elements.lozinka.required = !korisnik;
  el.racun.elements.lozinka.placeholder = korisnik ? 'Ostavi prazno za postojeću lozinku' : '';
  el['obrisi-racun'].hidden = !korisnik;
  el['planovi-stupac'].hidden = !korisnik;
  el.plan.hidden = true;
  if (korisnik) await ucitajPlanove(null, aktualno);
}

async function ucitajKorisnike(id, aktualno) {
  var redovi = await zatrazi('admin/korisnici');
  if (!aktualno()) return;
  korisnici = redovi;
  opcije(el.korisnici, korisnici.map(function (red) {
    return [red.id, red.email + (red.uloga === 'admin' ? ' · administrator' : '')];
  }), 'Odaberi račun');
  var odabrani = korisnici.find(function (red) { return red.id === id || red.email === id; });
  await prikaziKorisnika(odabrani?.id || null, aktualno);
}

function dodajKorak(korak, dovrsen) {
  var grupa = document.createElement('fieldset');
  grupa.className = 'admin-korak';
  grupa.innerHTML = '<legend>Korak</legend><label>Izvor<input maxlength="100" required></label>'
    + '<label>Uputa<textarea maxlength="750" required></textarea></label>'
    + '<label>Isječak<textarea maxlength="750" required></textarea></label>'
    + '<label><input type="checkbox"> Dovršen</label>'
    + '<button class="tekst-gumb" type="button">Ukloni korak</button>';
  var [izvor, uputa, tekst, oznaka] = grupa.querySelectorAll('input, textarea');
  izvor.value = korak?.izvor || '';
  uputa.value = korak?.uputa || '';
  tekst.value = korak?.tekst || '';
  oznaka.checked = dovrsen;
  grupa.querySelector('button').addEventListener('click', function () {
    if (el.koraci.children.length === 1) return poruka('Plan mora imati barem jedan korak.');
    grupa.remove();
    el['dodaj-korak'].disabled = false;
  });
  el.koraci.append(grupa);
  el['dodaj-korak'].disabled = el.koraci.children.length >= 10;
}

function prikaziPlan(plan, otvori) {
  planId = plan?.id;
  el.planovi.value = planId || '';
  el.plan.reset();
  el.plan.hidden = !otvori;
  el['obrisi-plan'].hidden = !plan;
  el.koraci.replaceChildren();
  if (!otvori) return;
  if (plan) {
    ['naziv', 'mod', 'cilj', 'minute', 'razlog'].forEach(function (kljuc) {
      el.plan.elements[kljuc].value = plan[kljuc];
    });
    plan.zadaci.forEach(function (korak, i) { dodajKorak(korak, plan.dovrseni.includes(i)); });
  } else {
    dodajKorak(null, false);
  }
}

async function ucitajPlanove(id, aktualno) {
  var redovi = await zatrazi(rutaPlanova());
  if (!aktualno()) return;
  planovi = redovi;
  opcije(el.planovi, planovi.map(function (plan) { return [plan.id, plan.naziv]; }), 'Odaberi plan');
  var plan = planovi.find(function (plan) { return plan.id === id; });
  prikaziPlan(plan, Boolean(plan));
}

el.gumb.addEventListener('click', function () {
  if (zauzeto) return;
  el.panel.hidden = false;
  el.naslov.focus();
  izvrsi(function (aktualno) { return ucitajKorisnike(administrator, aktualno); });
});
el.korisnici.addEventListener('change', function () {
  izvrsi(function (aktualno) { return prikaziKorisnika(Number(el.korisnici.value) || null, aktualno); });
});
el['novi-racun'].addEventListener('click', function () {
  izvrsi(function (aktualno) { return prikaziKorisnika(null, aktualno); });
});
el.racun.addEventListener('submit', function (event) {
  event.preventDefault();
  var podaci = polja(el.racun);
  izvrsi(async function (aktualno) {
    var id = korisnikId;
    await zatrazi('admin/korisnici' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', podaci);
    if (!aktualno()) return;
    if (id === administrator) {
      var odgovor = await trenutniRacun();
      if (!aktualno()) return;
      promijeniRacun(odgovor.korisnik);
      if (!aktualno()) return;
    }
    await ucitajKorisnike(id || podaci.email.trim().toLowerCase(), aktualno);
    return 'Račun je spremljen.';
  });
});
el['obrisi-racun'].addEventListener('click', function () {
  if (zauzeto || !korisnikId || !confirm('Izbrisati račun i sve njegove planove?')) return;
  izvrsi(async function (aktualno) {
    var id = korisnikId;
    await zatrazi('admin/korisnici/' + id, 'DELETE');
    if (!aktualno()) return;
    if (id === administrator) return promijeniRacun(null);
    await ucitajKorisnike(administrator, aktualno);
    return 'Račun je izbrisan.';
  });
});
el.planovi.addEventListener('change', function () {
  var plan = planovi.find(function (red) { return red.id === el.planovi.value; });
  prikaziPlan(plan, Boolean(plan));
});
el['novi-plan'].addEventListener('click', function () { prikaziPlan(null, true); });
el['dodaj-korak'].addEventListener('click', function () { dodajKorak(null, false); });
el.plan.addEventListener('submit', function (event) {
  event.preventDefault();
  var plan = polja(el.plan);
  plan.minute = Number(plan.minute);
  plan.dovrseni = [];
  plan.zadaci = Array.from(el.koraci.children).map(function (grupa, i) {
    var [izvor, uputa, tekst, oznaka] = grupa.querySelectorAll('input, textarea');
    if (oznaka.checked) plan.dovrseni.push(i);
    return { izvor: izvor.value.trim(), uputa: uputa.value.trim(), tekst: tekst.value.trim() };
  });
  izvrsi(async function (aktualno) {
    var id = planId || noviId();
    await zatrazi(rutaPlanova() + '/' + id, planId ? 'PATCH' : 'PUT', plan);
    if (aktualno()) await ucitajPlanove(id, aktualno);
    return 'Plan je spremljen.';
  });
});
el['obrisi-plan'].addEventListener('click', function () {
  if (zauzeto || !planId || !confirm('Izbrisati odabrani plan?')) return;
  izvrsi(async function (aktualno) {
    await zatrazi(rutaPlanova() + '/' + planId, 'DELETE');
    if (aktualno()) await ucitajPlanove(null, aktualno);
    return 'Plan je izbrisan.';
  });
});

export { postaviAdministratora };
