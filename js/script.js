import { MODOVI, CILJEVI, izradiPlan } from './plan.js';
import * as baza from './baza.js';
import { postaviAdministratora } from './admin.js';

var el = {};
document.querySelectorAll('[id]').forEach(function (element) { el[element.id] = element; });

var bazaSpremna = false;
var korisnik;
var pracenje;
var spremljeni = [];
var aktivniPlan;
var spremljenId;
var nacrtId;
var aktivniKorak = 0;
var cekaSpremanje = false;
var citaDokument = false;
var pokusaj = 0;
var tokenObnove = /^#obnova=([a-f0-9]{64})$/.exec(location.hash)?.[1];
if (tokenObnove) history.replaceState(null, '', location.pathname + location.search);
var datum = new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' });

var nacin = new URLSearchParams(location.search).get('mod');
if (Object.hasOwn(MODOVI, nacin)) el.stanje.value = nacin;

function gumb(tekst, klasa, klik) {
  var element = document.createElement('button');
  element.type = 'button';
  element.className = klasa;
  element.textContent = tekst;
  element.addEventListener('click', klik);
  return element;
}

function ispravanPlan(plan) {
  return plan && typeof plan.naziv === 'string' && typeof plan.razlog === 'string'
    && Object.hasOwn(MODOVI, plan.mod) && Object.hasOwn(CILJEVI, plan.cilj)
    && [10, 20, 35, 50].includes(plan.minute) && Array.isArray(plan.dovrseni)
    && Array.isArray(plan.zadaci) && plan.zadaci.length > 0
    && plan.zadaci.every(function (zadatak) {
      return zadatak && ['uputa', 'izvor', 'tekst'].every(function (kljuc) {
        return typeof zadatak[kljuc] === 'string';
      });
    });
}

function ukupanNapredak(plan) {
  return plan.zadaci.filter(function (_, i) { return plan.dovrseni.includes(i); }).length;
}

function prviNedovrseni(plan, od) {
  for (var i = 0; i < plan.zadaci.length; i++) {
    var indeks = (od + i) % plan.zadaci.length;
    if (!plan.dovrseni.includes(indeks)) return indeks;
  }
  return -1;
}

function postaviPlan(plan, id, prebaciFokus) {
  aktivniPlan = plan;
  spremljenId = id;
  nacrtId = null;
  aktivniKorak = plan ? prviNedovrseni(plan, 0) : -1;
  el['plan-poruka'].textContent = '';
  prikaziPlan();
  if (prebaciFokus) el['plan-naslov'].focus();
}

function prikaziPlan() {
  el['plan-prazno'].hidden = Boolean(aktivniPlan);
  el['plan-sadrzaj'].hidden = !aktivniPlan;
  if (!aktivniPlan) return;

  var plan = aktivniPlan;
  var zadatak = plan.zadaci[aktivniKorak];
  var gotovo = ukupanNapredak(plan);
  el['naziv-dokumenta'].textContent = plan.naziv;
  el.mod.textContent = MODOVI[plan.mod].naziv;
  el.mod.dataset.mod = plan.mod;
  el.gradivo.textContent = CILJEVI[plan.cilj] + ' · ' + plan.minute + ' min na raspolaganju';
  el.razlog.textContent = plan.razlog;
  el.napredak.max = plan.zadaci.length;
  el.napredak.value = gotovo;
  el['napredak-tekst'].textContent = gotovo + ' / ' + plan.zadaci.length;
  el.korak.hidden = !zadatak;
  el['plan-zavrsen'].hidden = gotovo !== plan.zadaci.length;
  el.spremi.hidden = Boolean(spremljenId);
  el.spremi.textContent = korisnik ? 'Spremi plan' : 'Prijavi se za spremanje';
  el.spremi.disabled = !bazaSpremna || cekaSpremanje || citaDokument;
  el.dovrsi.disabled = cekaSpremanje || citaDokument || !zadatak || plan.dovrseni.includes(aktivniKorak);
  el.preskoci.disabled = cekaSpremanje || gotovo >= plan.zadaci.length - 1;
  el.redoslijed.hidden = plan.mod === 'preopterecenost' && gotovo < plan.zadaci.length;
  el.redoslijed.replaceChildren();

  if (zadatak) {
    el.izvor.textContent = 'Korak ' + (aktivniKorak + 1) + ' · ' + zadatak.izvor;
    el.uputa.textContent = zadatak.uputa;
    el.tekst.textContent = zadatak.tekst;
    el.isjecak.hidden = zadatak.tekst === zadatak.uputa;
    el.podrska.textContent = MODOVI[plan.mod].podrska;
  }

  if (el.redoslijed.hidden) return;
  plan.zadaci.forEach(function (zapis, i) {
    var stavka = document.createElement('li');
    var naslov = zapis.izvor + (plan.dovrseni.includes(i) ? ' · dovršeno' : '');
    var otvori = gumb(naslov, 'tekst-gumb', function () { prikaziKorak(i); });
    if (i === aktivniKorak) otvori.setAttribute('aria-current', 'step');
    otvori.disabled = cekaSpremanje;
    stavka.append(otvori);
    el.redoslijed.append(stavka);
  });
}

function prikaziKorak(indeks, fokus) {
  aktivniKorak = indeks;
  el.isjecak.open = false;
  prikaziPlan();
  if (fokus !== false) (indeks >= 0 ? el.uputa : el['plan-naslov']).focus();
}

el.postavke.addEventListener('submit', async function (dogadjaj) {
  dogadjaj.preventDefault();
  var datoteka = el.datoteka.files[0];
  if (!datoteka || cekaSpremanje || citaDokument) return;

  var zahtjev = ++pokusaj;
  var cilj = el.cilj.value;
  var minute = Number(el.minute.value);
  var stanje = el.stanje.value;
  citaDokument = true;
  el.izradi.disabled = true;
  prikaziPlan();
  el['unos-poruka'].textContent = 'Čitam dokument i pripremam korake…';

  var dokumenti;
  try {
    dokumenti = await import('./dokumenti.js');
    var jedinice = await dokumenti.ucitajDokument(datoteka);
    if (pokusaj !== zahtjev) return;
    postaviPlan(izradiPlan(jedinice, datoteka.name, cilj, minute, stanje), null, true);
    el.isjecak.open = false;
    el['unos-poruka'].textContent = '';
  } catch (greska) {
    if (pokusaj !== zahtjev) return;
    el['unos-poruka'].textContent = dokumenti && greska instanceof dokumenti.GreskaDokumenta
      ? greska.message : 'Čitanje dokumenta nije uspjelo. Provjeri format i pokušaj ponovno.';
  } finally {
    if (pokusaj === zahtjev) {
      citaDokument = false;
      el.izradi.disabled = false;
      prikaziPlan();
    }
  }
});

el.preskoci.addEventListener('click', function () {
  prikaziKorak(prviNedovrseni(aktivniPlan, (aktivniKorak + 1) % aktivniPlan.zadaci.length));
});

function stanjeSpremanja(sprema, poruka) {
  cekaSpremanje = sprema;
  el.izradi.disabled = sprema || citaDokument;
  el['plan-poruka'].textContent = poruka;
  prikaziPlan();
}

el.dovrsi.addEventListener('click', async function () {
  if (cekaSpremanje || citaDokument || !aktivniPlan) return;
  var plan = aktivniPlan;
  var id = spremljenId;
  var indeks = aktivniKorak;

  if (id) {
    var korisnikId = korisnik.id;
    stanjeSpremanja(true, 'Spremam napredak…');
    try {
      await baza.dovrsi(korisnikId, id, indeks);
    } catch (greska) {
      if (korisnik?.id === korisnikId) stanjeSpremanja(false, 'Napredak nije spremljen. Pokušaj ponovno.');
      return;
    }
    if (korisnik?.id !== korisnikId) return;
    stanjeSpremanja(false, 'Napredak je spremljen.');
    pracenje?.ucitaj(true);
  }

  var trenutni = id ? aktivniPlan : plan;
  if (!trenutni || spremljenId !== id) return;
  if (!trenutni.dovrseni.includes(indeks)) trenutni.dovrseni.push(indeks);
  prikaziKorak(prviNedovrseni(trenutni, (indeks + 1) % trenutni.zadaci.length));
});

el.spremi.addEventListener('click', async function () {
  if (cekaSpremanje || citaDokument || !aktivniPlan || !bazaSpremna) return;
  if (!korisnik) {
    el.racun.showModal();
    return;
  }
  var korisnikId = korisnik.id;
  nacrtId = nacrtId || baza.noviId();
  var id = nacrtId;
  stanjeSpremanja(true, 'Spremam plan…');
  try {
    await baza.spremi(korisnikId, id, aktivniPlan);
    if (korisnik?.id !== korisnikId) return;
    spremljenId = id;
    stanjeSpremanja(false, 'Plan je spremljen na račun.');
    pracenje?.ucitaj(true);
  } catch (greska) {
    if (korisnik?.id === korisnikId) stanjeSpremanja(false, 'Plan nije spremljen. Pokušaj ponovno.');
  }
});

function prikaziPovijest() {
  el.spremljeni.replaceChildren();
  spremljeni.forEach(function (plan) {
    var stavka = document.createElement('li');
    var naziv = document.createElement('strong');
    var opis = document.createElement('span');
    var akcije = document.createElement('div');
    naziv.textContent = plan.naziv;
    opis.textContent = MODOVI[plan.mod].naziv + ' · ' + ukupanNapredak(plan) + '/' + plan.zadaci.length + ' dovršeno'
      + (plan.stvoren && Number.isFinite(Date.parse(plan.stvoren)) ? ' · ' + datum.format(new Date(plan.stvoren)) : '');
    akcije.className = 'akcije';
    var nastavi = gumb('Otvori', 'sporedni', function () {
      if (cekaSpremanje) return;
      if (citaDokument) {
        pokusaj++;
        citaDokument = false;
        el.izradi.disabled = false;
        el['unos-poruka'].textContent = '';
      }
      postaviPlan(plan, plan.id, true);
    });
    var obrisi = gumb('Izbriši', 'tekst-gumb', async function () {
      if (cekaSpremanje || !korisnik || !confirm('Izbrisati spremljeni plan „' + plan.naziv + '”?')) return;
      var korisnikId = korisnik.id;
      stanjeSpremanja(true, '');
      obrisi.disabled = true;
      try {
        await baza.ukloni(korisnikId, plan.id);
        if (korisnik?.id === korisnikId && spremljenId === plan.id) postaviPlan(null, null, false);
      } catch (greska) {
        if (korisnik?.id === korisnikId) el['povijest-poruka'].textContent = 'Brisanje nije uspjelo. Pokušaj ponovno.';
      } finally {
        if (korisnik?.id === korisnikId) {
          stanjeSpremanja(false, '');
          pracenje?.ucitaj(true);
          obrisi.disabled = false;
        }
      }
    });
    nastavi.setAttribute('aria-label', 'Otvori plan ' + plan.naziv);
    obrisi.setAttribute('aria-label', 'Izbriši plan ' + plan.naziv);
    akcije.append(nastavi, obrisi);
    stavka.append(naziv, opis, akcije);
    el.spremljeni.append(stavka);
  });
}

function prikaziStareSesije() {
  var sesije;
  try {
    sesije = JSON.parse(localStorage.getItem('povijest') || '[]');
  } catch (greska) {
    return;
  }
  if (!Array.isArray(sesije)) return;
  sesije.filter(function (sesija) {
    return sesija && Object.hasOwn(MODOVI, sesija.mod) && Number.isFinite(sesija.timestamp);
  }).sort(function (a, b) {
    return b.timestamp - a.timestamp;
  }).forEach(function (sesija) {
    var stavka = document.createElement('li');
    var trajanje = Number.isFinite(sesija.trajanje) && sesija.trajanje >= 0 ? ' · ' + sesija.trajanje + ' min' : '';
    var vrijeme = new Date(sesija.timestamp);
    if (!Number.isFinite(vrijeme.getTime())) return;
    stavka.textContent = datum.format(vrijeme) + ' · ' + MODOVI[sesija.mod].naziv + trajanje;
    el['stare-sesije'].append(stavka);
  });
  el['stara-povijest'].hidden = !el['stare-sesije'].children.length;
}

function promijeniKorisnika(noviKorisnik) {
  if (korisnik && korisnik.id !== noviKorisnik?.id) {
    pokusaj++;
    citaDokument = false;
    el.postavke.reset();
    el['unos-poruka'].textContent = '';
    stanjeSpremanja(false, '');
    postaviPlan(null, null, false);
  }
  korisnik = noviKorisnik;
  postaviAdministratora(korisnik, promijeniKorisnika);
  pracenje?.zaustavi();
  pracenje = null;
  spremljeni = [];
  prikaziPovijest();
  prikaziPlan();
  el['racun-gumb'].disabled = false;
  el['racun-gumb'].textContent = korisnik ? 'Moj račun' : 'Prijava';
  el.prijava.hidden = Boolean(korisnik || tokenObnove);
  el.prijavljeni.hidden = !korisnik || Boolean(tokenObnove);
  el['nova-lozinka'].hidden = !tokenObnove;
  el['korisnik-email'].textContent = korisnik?.email || '';
  el['povijest-poruka'].textContent = korisnik ? 'Učitavam spremljene planove…' : 'Prijavi se za spremanje i nastavak rada na drugom uređaju.';
  if (!korisnik) return;

  var korisnikId = korisnik.id;
  pracenje = baza.pratiPlanove(korisnikId, function (planovi) {
    if (korisnik?.id !== korisnikId) return;
    spremljeni = planovi.filter(ispravanPlan);
    el['povijest-poruka'].textContent = spremljeni.length ? '' : 'Još nemaš spremljenih planova.';
    prikaziPovijest();

    var odabrani = spremljeni.find(function (plan) { return plan.id === spremljenId; });
    if (odabrani && !cekaSpremanje) {
      aktivniPlan = odabrani;
      if (aktivniKorak < 0 || aktivniKorak >= odabrani.zadaci.length || odabrani.dovrseni.includes(aktivniKorak)) {
        var pocetak = aktivniKorak >= 0 && aktivniKorak < odabrani.zadaci.length ? aktivniKorak : 0;
        prikaziKorak(prviNedovrseni(odabrani, pocetak), false);
      } else {
        prikaziPlan();
      }
    }
    if (!odabrani && spremljenId && !cekaSpremanje) {
      postaviPlan(null, null, false);
    }
  }, function (greska) {
    if (greska.status === 401) {
      promijeniKorisnika(null);
      baza.trenutniRacun().then(function (racun) {
        if (!korisnik && racun.korisnik) promijeniKorisnika(racun.korisnik);
      }).catch(function () {});
      return;
    }
    el['povijest-poruka'].textContent = 'Spremljeni planovi trenutačno nisu dostupni.';
  });
}

el['racun-gumb'].addEventListener('click', function () {
  el['racun-poruka'].textContent = '';
  el.racun.showModal();
});
el['zatvori-racun'].addEventListener('click', function () { el.racun.close(); });
el.racun.addEventListener('close', function () {
  if (!tokenObnove) return;
  tokenObnove = null;
  promijeniKorisnika(korisnik);
});

el.prijava.addEventListener('submit', async function (dogadjaj) {
  dogadjaj.preventDefault();
  var registracija = dogadjaj.submitter?.value === 'registracija';
  var gumbi = el.prijava.querySelectorAll('button');
  gumbi.forEach(function (gumb) { gumb.disabled = true; });
  el['racun-poruka'].textContent = 'Povezujem račun…';
  try {
    var akcija = registracija ? baza.registriraj : baza.prijavi;
    var prijavljeni = await akcija(el.email.value.trim(), el.lozinka.value);
    promijeniKorisnika(prijavljeni);
    el.prijava.reset();
    el.racun.close();
  } catch (greska) {
    var poruke = {
      'racun-postoji': 'Račun s tom e-adresom već postoji. Prijavi se.',
      'neispravni-podaci': 'Upiši ispravnu e-adresu i lozinku od najmanje osam znakova.',
      'previse-pokusaja': 'Previše pokušaja. Pokušaj ponovno za 15 minuta.',
      'pogresna-prijava': 'E-adresa ili lozinka nisu ispravne.'
    };
    el['racun-poruka'].textContent = poruke[greska.code] || 'Prijava ili registracija nije uspjela. Provjeri vezu i pokušaj ponovno.';
  } finally {
    gumbi.forEach(function (gumb) { gumb.disabled = false; });
  }
});

el['obnovi-lozinku'].addEventListener('click', async function () {
  if (!el.email.reportValidity()) return;
  el['obnovi-lozinku'].disabled = true;
  try {
    await baza.posaljiObnovu(el.email.value.trim());
    el['racun-poruka'].textContent = 'Ako postoji račun s tom adresom, poslana je poveznica za obnovu.';
  } catch (greska) {
    el['racun-poruka'].textContent = 'Obnova lozinke trenutačno nije dostupna. Pokušaj ponovno kasnije.';
  } finally {
    el['obnovi-lozinku'].disabled = false;
  }
});

el['nova-lozinka'].addEventListener('submit', async function (dogadjaj) {
  dogadjaj.preventDefault();
  el['spremi-lozinku'].disabled = true;
  try {
    await baza.postaviLozinku(tokenObnove, el['nova-lozinka-polje'].value);
    tokenObnove = null;
    promijeniKorisnika(null);
    el['nova-lozinka'].reset();
    el['racun-poruka'].textContent = 'Lozinka je promijenjena. Prijavi se s novom lozinkom.';
  } catch (greska) {
    el['racun-poruka'].textContent = greska.code === 'poveznica-istekla'
      ? 'Poveznica je istekla ili je već iskorištena.' : 'Promjena lozinke nije uspjela.';
  } finally {
    el['spremi-lozinku'].disabled = false;
  }
});

el.odjava.addEventListener('click', async function () {
  el.odjava.disabled = true;
  try {
    await baza.odjavi();
    promijeniKorisnika(null);
    el.racun.close();
  } catch (greska) {
    el['racun-poruka'].textContent = 'Odjava nije uspjela. Pokušaj ponovno.';
  } finally {
    el.odjava.disabled = false;
  }
});

prikaziStareSesije();
baza.trenutniRacun().then(function (racun) {
  bazaSpremna = true;
  el['obnovi-lozinku'].hidden = !racun.obnovaDostupna;
  promijeniKorisnika(racun.korisnik);
  if (tokenObnove) el.racun.showModal();
}).catch(function (greska) {
  el['povijest-poruka'].textContent = greska.code === 'baza-nije-postavljena'
    ? 'Spremanje je dostupno nakon povezivanja s MariaDB bazom.'
    : 'Račun i spremljeni planovi trenutačno nisu dostupni.';
  prikaziPlan();
});
