var RING_CIRC = 2 * Math.PI * 90;

var sesija = JSON.parse(sessionStorage.getItem('trenutnaSesija')) || null;
if (!sesija || sesija.mod !== 'motivacija') {
  sesija = { mod: 'motivacija', datum: new Date().toISOString().slice(0, 10), pocetak: Date.now() };
  sessionStorage.setItem('trenutnaSesija', JSON.stringify(sesija));
}

var sesijaBrojac = document.getElementById('sesija-brojac');
setInterval(function () {
  var p = Math.floor((Date.now() - sesija.pocetak) / 1000);
  sesijaBrojac.textContent = String(Math.floor(p / 60)).padStart(2, '0') + ':' + String(p % 60).padStart(2, '0');
}, 1000);

window.addEventListener('beforeunload', function () {
  var t = Math.round((Date.now() - sesija.pocetak) / 1000 / 60);
  if (t < 1) return;
  var pd = new Date(sesija.pocetak);
  var vp = pd.getHours().toString().padStart(2,'0') + ':' + pd.getMinutes().toString().padStart(2,'0');
  var povijest = JSON.parse(localStorage.getItem('povijest')) || [];
  povijest.push({ mod: 'motivacija', datum: sesija.datum, vrijemePocetka: vp, trajanje: t, timestamp: Date.now() });
  localStorage.setItem('povijest', JSON.stringify(povijest));
  sessionStorage.removeItem('trenutnaSesija');
});

var motivPoruke = [
  "Možeš ovo! Samo fokus. 💪",
  "Jedan zadatak, jedna pobjeda!",
  "Ti si brži nego misliš!",
  "Daj sve od sebe!",
  "Svaki završeni zadatak je uspjeh!",
  "Kreni — ostatak dolazi sam.",
  "Pokušaj nadmašiti samog sebe."
];

var odabranoVrijeme = 10 * 60;
var timerSekunde    = odabranoVrijeme;
var timerInterval   = null;
var timerStanje     = 'idle';
var redCekanja      = [];
var zavrsenoCount   = 0;
var ukupnoCount     = 0;

var elPlaniranje   = document.getElementById('planiranje-view');
var elAktivan      = document.getElementById('aktivan-view');
var elListaEdit    = document.getElementById('lista-editable');
var elListaLocked  = document.getElementById('lista-locked');
var elInput        = document.getElementById('todo-input');
var elDodaj        = document.getElementById('todo-dodaj');
var elLista        = document.getElementById('todo-lista');
var elListaGreska  = document.getElementById('lista-greska');
var elBtnGotovo    = document.getElementById('btn-gotovo');
var elBtnUredi     = document.getElementById('btn-uredi');
var elBtnKreni     = document.getElementById('btn-kreni');
var elLockTekst    = document.getElementById('lock-tekst');
var elPreviewVr    = document.getElementById('preview-vremena');
var elProgFill     = document.getElementById('prog-fill');
var elProgTekst    = document.getElementById('prog-tekst');
var elRing         = document.getElementById('ring-progress');
var elTimerPrikaz  = document.getElementById('timer-prikaz');
var elTimerSub     = document.getElementById('timer-sub');
var elMotivTekst   = document.getElementById('motiv-izazov-tekst');
var elAktivanBroj  = document.getElementById('aktivan-broj');
var elAktivanUk    = document.getElementById('aktivan-ukupno');
var elAktivanNaziv = document.getElementById('aktivan-naziv');
var elBtnZavrsio   = document.getElementById('btn-zavrsio');
var elBtnIduci     = document.getElementById('btn-iduci');
var elBtnUrediAkt  = document.getElementById('btn-uredi-aktivan');
var elDoneScreen   = document.getElementById('done-screen');
var elBtnNovaLista = document.getElementById('btn-nova-lista');
var elToast        = document.getElementById('motiv-toast');

var elNagradaInput        = document.getElementById('nagrada-input');
var elAktivanNagrada      = document.getElementById('aktivan-nagrada');
var elAktivanNagradaTekst = document.getElementById('aktivan-nagrada-tekst');
var elDoneNagrade         = document.getElementById('done-nagrade');

var elBar        = document.getElementById('trenutni-bar');
var elBarNaziv   = document.getElementById('bar-naziv');
var elBarStatus  = document.getElementById('bar-status');
var elBarNagr    = document.getElementById('bar-nagr');
var elBarNagrTxt = document.getElementById('bar-nagr-tekst');
var aktivniPlanIdx = null;

var zadaci = JSON.parse(sessionStorage.getItem('motiv-zadaci')) || [];

function spremiZadatke() {
  sessionStorage.setItem('motiv-zadaci', JSON.stringify(zadaci));
}

function osvjeziPlanBar() {
  if (aktivniPlanIdx !== null && zadaci[aktivniPlanIdx]) {
    var z = zadaci[aktivniPlanIdx];
    elBarNaziv.textContent = z.tekst;
    if (z.nagrada) {
      elBarNagrTxt.textContent = z.nagrada;
      elBarNagr.classList.remove('skriveno');
    } else {
      elBarNagr.classList.add('skriveno');
    }
    elBarStatus.textContent = z.zavrsen ? 'Završeno' : 'Na listi';
    elBarStatus.className = 'bar-status ' + (z.zavrsen ? 'bar-status--done' : 'bar-status--active');
    elBar.classList.add('vidljiv');
    document.body.classList.add('bar-aktivan');
  } else {
    elBarNagr.classList.add('skriveno');
    elBar.classList.remove('vidljiv');
    document.body.classList.remove('bar-aktivan');
  }
}

var toastTimeout;
function prikaziToast(poruka) {
  clearTimeout(toastTimeout);
  elToast.textContent = poruka;
  elToast.classList.add('vidljiv');
  toastTimeout = setTimeout(function () { elToast.classList.remove('vidljiv'); }, 3000);
}

function formatirajVrijeme(sec) {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

function osvjeziRing() {
  var idx = redCekanja.length > 0 ? redCekanja[0] : null;
  var maxZaRing = (idx !== null && zadaci[idx] && zadaci[idx].preostalo)
    ? zadaci[idx].preostalo
    : odabranoVrijeme;
  var progress = maxZaRing > 0 ? timerSekunde / maxZaRing : 1;
  elRing.style.strokeDashoffset = RING_CIRC * (1 - progress);
}

function osvjeziTimerPrikaz() {
  elTimerPrikaz.textContent = formatirajVrijeme(timerSekunde);
  elTimerSub.textContent = timerSekunde === odabranoVrijeme ? 'spremi se' : 'preostalo';
}

function pokreniTimer() {
  timerStanje = 'running';
  elTimerPrikaz.classList.add('running');
  timerInterval = setInterval(function () {
    if (timerSekunde <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerStanje = 'idle';
      elTimerPrikaz.classList.remove('running');
      prikaziToast('Nema veze! Nastavi kada si spreman. 🙂');
      timerSekunde = odabranoVrijeme;
      osvjeziTimerPrikaz();
      osveziRing();
      pokreniTimer();
      return;
    }
    timerSekunde--;
    osvjeziTimerPrikaz();
    osvjeziRing();
  }, 1000);
}

function zaustaviTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerStanje = 'idle';
  elTimerPrikaz.classList.remove('running');
}

function resetirajTimerZaNovi(idx) {
  zaustaviTimer();
  timerSekunde = (idx !== undefined && zadaci[idx] && zadaci[idx].preostalo)
    ? zadaci[idx].preostalo
    : odabranoVrijeme;
  osvjeziTimerPrikaz();
  osvjeziRing();
}

document.querySelectorAll('.timer-preset').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.timer-preset').forEach(function (b) { b.classList.remove('aktivan'); });
    btn.classList.add('aktivan');
    odabranoVrijeme = parseInt(btn.dataset.preset, 10);
    timerSekunde    = odabranoVrijeme;
    elPreviewVr.textContent = formatirajVrijeme(odabranoVrijeme);
  });
});

function renderLista() {
  elLista.innerHTML = '';
  if (zadaci.length === 0) {
    elLista.innerHTML = '<li class="todo-prazno">Dodaj zadatke koje trebaš završiti.</li>';
    return;
  }
  zadaci.forEach(function (z, i) {
    var li = document.createElement('li');
    li.className = 'todo-item' + (z.zavrsen ? ' todo-item--done' : '') + (aktivniPlanIdx === i ? ' todo-item--active' : '');

    var check = document.createElement('button');
    check.className = 'todo-check';
    check.innerHTML = z.zavrsen
      ? '<svg viewBox="0 0 24 24" fill="none"><polyline points="5,12 10,17 19,7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none"></svg>';
    check.addEventListener('click', function (e) {
      e.stopPropagation();
      zadaci[i].zavrsen = !zadaci[i].zavrsen;
      spremiZadatke();
      renderLista();
    });

    var tekstWrap = document.createElement('div');
    tekstWrap.className = 'todo-tekst-wrap';

    var tekst = document.createElement('span');
    tekst.className = 'todo-tekst';
    tekst.textContent = z.tekst;
    tekstWrap.appendChild(tekst);

    if (z.nagrada) {
      var badge = document.createElement('span');
      badge.className = 'todo-nagrada-badge';
      badge.textContent = '🎁 ' + z.nagrada;
      tekstWrap.appendChild(badge);
    }

    var del = document.createElement('button');
    del.className = 'todo-delete';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      zadaci.splice(i, 1);
      spremiZadatke();
      renderLista();
    });

    li.addEventListener('click', function () {
      aktivniPlanIdx = aktivniPlanIdx === i ? null : i;
      renderLista(); osvjeziPlanBar();
    });
    li.appendChild(check);
    li.appendChild(tekstWrap);
    li.appendChild(del);
    elLista.appendChild(li);
  });
}

function dodajZadatak() {
  var t = elInput.value.trim();
  if (!t) return;
  var n = elNagradaInput.value.trim();
  zadaci.push({ tekst: t, zavrsen: false, nagrada: n });
  elInput.value = '';
  elNagradaInput.value = '';
  spremiZadatke();
  renderLista();
  elListaGreska.classList.add('skriveno');
}

elDodaj.addEventListener('click', dodajZadatak);
elInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') dodajZadatak(); });

elBtnGotovo.addEventListener('click', function () {
  var nezavrseni = zadaci.filter(function (z) { return !z.zavrsen; });
  if (nezavrseni.length === 0) {
    elListaGreska.textContent = 'Dodaj barem jedan zadatak za početak.';
    elListaGreska.classList.remove('skriveno');
    return;
  }
  var br = nezavrseni.length;
  elLockTekst.textContent = br + ' ' + (br === 1 ? 'zadatak čeka' : br < 5 ? 'zadatka čekaju' : 'zadataka čeka');
  elListaEdit.classList.add('skriveno');
  elListaLocked.classList.remove('skriveno');
});

elBtnUredi.addEventListener('click', function () {
  elListaLocked.classList.add('skriveno');
  elListaEdit.classList.remove('skriveno');
  renderLista();
});

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

function azurirajProgress() {
  var zav = zadaci.filter(function (z) { return z.zavrsen; }).length;
  zavrsenoCount = zav;
  elProgFill.style.width  = (zav / ukupnoCount * 100) + '%';
  elProgTekst.textContent = zav + '/' + ukupnoCount;
}

function prikaziZadatak() {
  if (redCekanja.length === 0) {
    zaustaviTimer();
    var gridEl = elAktivan.querySelector('.fokus-grid');
    if (gridEl) gridEl.classList.add('skriveno');

    var nagrade = zadaci.filter(function(z) { return z.zavrsen && z.nagrada; });
    if (nagrade.length > 0) {
      var nagHTML = '<p class="motiv-done-nagrade-naslov">🎁 Zaslužene nagrade:</p><ul class="motiv-done-nagrade-lista">';
      nagrade.forEach(function(z) {
        nagHTML += '<li><strong>' + z.nagrada + '</strong><span>za: ' + z.tekst + '</span></li>';
      });
      nagHTML += '</ul>';
      elDoneNagrade.innerHTML = nagHTML;
      elDoneNagrade.classList.remove('skriveno');
    } else {
      elDoneNagrade.classList.add('skriveno');
    }

    elDoneScreen.classList.remove('skriveno');
    elBar.classList.remove('vidljiv');
    document.body.classList.remove('bar-aktivan');
    azurirajProgress();
    return;
  }

  var idx = redCekanja[0];
  var zavrsenoTrenutno = zadaci.filter(function(z) { return z.zavrsen; }).length;
  elAktivanBroj.textContent = zavrsenoTrenutno + 1;
  elAktivanUk.textContent   = ukupnoCount;

  elAktivanNaziv.style.opacity   = '0';
  elAktivanNaziv.style.transform = 'translateY(10px)';
  setTimeout(function () {
    elAktivanNaziv.textContent     = zadaci[idx].tekst;
    elAktivanNaziv.style.opacity   = '1';
    elAktivanNaziv.style.transform = 'translateY(0)';
  }, 220);

  elMotivTekst.textContent = motivPoruke[Math.floor(Math.random() * motivPoruke.length)];

  var bz = zadaci[idx];
  elBarNaziv.textContent = bz.tekst;
  if (bz.nagrada) {
    elBarNagrTxt.textContent = bz.nagrada;
    elBarNagr.classList.remove('skriveno');
  } else {
    elBarNagr.classList.add('skriveno');
  }
  elBarStatus.textContent = 'U tijeku';
  elBarStatus.className = 'bar-status bar-status--active';
  elBar.classList.add('vidljiv');
  document.body.classList.add('bar-aktivan');

  if (zadaci[idx].nagrada) {
    elAktivanNagradaTekst.textContent = zadaci[idx].nagrada;
    elAktivanNagrada.classList.remove('skriveno');
  } else {
    elAktivanNagrada.classList.add('skriveno');
  }
  if (zadaci[idx].preostalo) {
    elTimerSub.textContent = 'preostalo (nastavljeno)';
  }
  azurirajProgress();
}

elBtnKreni.addEventListener('click', function () {
  redCekanja  = zadaci.map(function (z, i) { return i; }).filter(function (i) { return !zadaci[i].zavrsen; });
  ukupnoCount = redCekanja.length;
  shuffle(redCekanja);

  elPlaniranje.classList.add('skriveno');
  elAktivan.classList.remove('skriveno');
  elDoneScreen.classList.add('skriveno');
  var gridEl = elAktivan.querySelector('.fokus-grid');
  if (gridEl) gridEl.classList.remove('skriveno');

  elRing.style.strokeDasharray = RING_CIRC;
  var prviIdx = redCekanja[0];
  timerSekunde = (zadaci[prviIdx] && zadaci[prviIdx].preostalo)
    ? zadaci[prviIdx].preostalo
    : odabranoVrijeme;
  osvjeziTimerPrikaz();
  osvjeziRing();
  prikaziZadatak();
  pokreniTimer();
});

elBtnZavrsio.addEventListener('click', function () {
  var preostalo = timerSekunde;
  var idx = redCekanja[0];
  var nagrada = zadaci[idx].nagrada;

  var toastTekst;
  if (preostalo > 30) {
    var min = Math.floor(preostalo / 60);
    var sek = preostalo % 60;
    toastTekst = min > 0
      ? 'Sjajno! ' + min + 'm ' + sek + 's ranije! 🎉'
      : 'Sjajno! ' + sek + 's ranije! 🎉';
  } else {
    toastTekst = 'Odlično! Zadatak završen! ✓';
  }
  if (nagrada) toastTekst += ' • 🎁 ' + nagrada;
  prikaziToast(toastTekst);

  delete zadaci[idx].preostalo;

  redCekanja.shift();
  zadaci[idx].zavrsen = true;
  spremiZadatke();
  var sljedeciIdx = redCekanja.length > 0 ? redCekanja[0] : undefined;
  resetirajTimerZaNovi(sljedeciIdx);
  prikaziZadatak();
  if (redCekanja.length > 0) pokreniTimer();
});

elBtnIduci.addEventListener('click', function () {
  var idx = redCekanja.shift();
  zadaci[idx].preostalo = timerSekunde;
  spremiZadatke();
  redCekanja.push(idx);
  var sljedeciIdx = redCekanja[0];
  resetirajTimerZaNovi(sljedeciIdx);
  prikaziZadatak();
  pokreniTimer();
});

function vratiNaPlaniranje() {
  zaustaviTimer();
  elAktivan.classList.add('skriveno');
  elDoneScreen.classList.add('skriveno');
  elListaLocked.classList.add('skriveno');
  elListaEdit.classList.remove('skriveno');
  elPlaniranje.classList.remove('skriveno');
  elBar.classList.remove('vidljiv');
  document.body.classList.remove('bar-aktivan');
  aktivniPlanIdx = null;
  renderLista();
}

elBtnUrediAkt.addEventListener('click', vratiNaPlaniranje);

elBtnNovaLista.addEventListener('click', function () {
  zadaci = [];
  spremiZadatke();
  redCekanja = [];
  vratiNaPlaniranje();
});

renderLista();

elRing.style.strokeDasharray  = RING_CIRC;
elRing.style.strokeDashoffset = 0;
osvjeziTimerPrikaz();