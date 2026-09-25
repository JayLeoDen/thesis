var ZADANO_ODMOR = 5 * 60;
var RING_CIRC    = 2 * Math.PI * 90;
var zaklj        = true;

var sesija = JSON.parse(sessionStorage.getItem('trenutnaSesija')) || null;
if (!sesija || sesija.mod !== 'umor') {
  sesija = { mod: 'umor', datum: new Date().toISOString().slice(0, 10), pocetak: Date.now() };
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
  var vp = pd.getHours().toString().padStart(2, '0') + ':' + pd.getMinutes().toString().padStart(2, '0');
  var povijest = JSON.parse(localStorage.getItem('povijest')) || [];
  povijest.push({ mod: 'umor', datum: sesija.datum, vrijemePocetka: vp, trajanje: t, timestamp: Date.now() });
  localStorage.setItem('povijest', JSON.stringify(povijest));
  sessionStorage.removeItem('trenutnaSesija');
});

var timerSekunde  = ZADANO_ODMOR;
var maxSekunde    = ZADANO_ODMOR;
var timerInterval = null;
var timerStanje   = 'idle';

var elPrikaz     = document.getElementById('timer-prikaz');
var elSub        = document.getElementById('timer-sub');
var elGumb       = document.getElementById('timer-gumb');
var elIkona      = document.getElementById('timer-ikona');
var elGumbTxt    = document.getElementById('timer-gumb-tekst');
var elReset      = document.getElementById('timer-reset');
var elRing       = document.getElementById('ring-progress');
var elDah        = document.getElementById('odmor-dah');
var elInput      = document.getElementById('todo-input');
var elDodaj      = document.getElementById('todo-dodaj');
var elLista      = document.getElementById('todo-lista');
var elLockBanner = document.getElementById('lock-banner');
var elLockIkona  = document.getElementById('lock-ikona');
var elLockPoruka = document.getElementById('lock-poruka');
var elCheckin    = document.getElementById('umor-checkin');
var elBtnOsvj    = document.getElementById('btn-osvjezen');
var elBtnJosOdm  = document.getElementById('btn-jos-odmora');
var elUmorTip    = document.getElementById('umor-tip');
var elBar        = document.getElementById('trenutni-bar');
var elBarNaziv   = document.getElementById('bar-naziv');
var elBarStatus  = document.getElementById('bar-status');
var elProgressW  = document.getElementById('todo-progress-wrap');
var elProgressF  = document.getElementById('todo-progress-fill');
var elProgressT  = document.getElementById('todo-progress-tekst');

elRing.style.strokeDasharray  = RING_CIRC;
elRing.style.strokeDashoffset = 0;

var DAH_FAZE = ['Udahni...', 'Drži...', 'Izdahni...', 'Pauza...'];
var dahIdx = 0;
var dahTimeout = null;

function ciklajDah() {
  elDah.style.opacity = '0';
  setTimeout(function () {
    elDah.textContent = DAH_FAZE[dahIdx];
    elDah.style.opacity = '1';
    dahIdx = (dahIdx + 1) % DAH_FAZE.length;
    dahTimeout = setTimeout(ciklajDah, 4000);
  }, 250);
}

function pokreniDah() {
  dahIdx = 0;
  elDah.textContent = DAH_FAZE[0];
  elDah.style.transition = 'opacity .25s ease';
  elDah.style.opacity = '1';
  elDah.classList.add('vidljiv');
  dahIdx = 1;
  dahTimeout = setTimeout(ciklajDah, 4000);
}

function zaustaviDah() {
  clearTimeout(dahTimeout); dahTimeout = null;
  elDah.classList.remove('vidljiv');
  elDah.style.opacity = '0';
}

function formatiraj(sec) {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}
function osvjeziPrikaz() {
  elPrikaz.textContent = formatiraj(timerSekunde);
  elSub.textContent = timerSekunde % 60 === 0 ? 'minuta odmora' : 'preostalo';
}
function osvjeziRing() {
  var p = maxSekunde > 0 ? timerSekunde / maxSekunde : 1;
  elRing.style.strokeDashoffset = RING_CIRC * (1 - p);
}
function osvjeziGumb() {
  if (timerStanje === 'running') {
    elIkona.innerHTML = '<rect x="5" y="4" width="4" height="16" rx="1.5" fill="white"/><rect x="15" y="4" width="4" height="16" rx="1.5" fill="white"/>';
    elGumbTxt.textContent = 'Pauziraj odmor';
    elPrikaz.classList.add('running');
  } else {
    elIkona.innerHTML = '<polygon points="6,4 20,12 6,20" fill="white"/>';
    elGumbTxt.textContent = timerStanje === 'paused' ? 'Nastavi odmor' : timerSekunde <= 0 ? 'Pokreni ponovo' : 'Pokreni odmor';
    elPrikaz.classList.remove('running');
  }
}

function prikaziCheckin() {
  elLockBanner.style.display = 'none';
  elCheckin.classList.remove('skriveno');
}

function pokreniTimer() {
  if (!zaklj) {
    zaklj = true;
    elInput.disabled = true; elDodaj.disabled = true;
    elLista.classList.add('zakljucano');
    elUmorTip.classList.add('skriveno');
    elCheckin.classList.add('skriveno');
    elLockBanner.style.display = '';
    elLockBanner.style.opacity = '1';
    elLockBanner.classList.remove('otklj');
    elLockIkona.textContent = '\uD83D\uDD12';
    elLockPoruka.textContent = 'Odmori se da otklju\u010da\u0161 zadatke';
    if (aktivniIdx !== null) { aktivniIdx = null; osvjeziBar(); }
  }
  timerStanje = 'running'; osvjeziGumb(); pokreniDah();
  timerInterval = setInterval(function () {
    if (timerSekunde <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      timerStanje = 'done';
      zaustaviDah(); osvjeziPrikaz(); osvjeziRing(); osvjeziGumb();
      prikaziCheckin(); return;
    }
    timerSekunde--; osvjeziPrikaz(); osvjeziRing();
  }, 1000);
}

function zaustaviTimer() {
  clearInterval(timerInterval); timerInterval = null;
  timerStanje = 'paused'; zaustaviDah(); osvjeziGumb();
}
function resetirajTimer() {
  clearInterval(timerInterval); timerInterval = null;
  timerStanje = 'idle'; timerSekunde = maxSekunde;
  zaustaviDah(); osvjeziPrikaz(); osvjeziRing(); osvjeziGumb();
}

elGumb.addEventListener('click', function () {
  if (timerStanje === 'running') { zaustaviTimer(); }
  else { if (timerSekunde <= 0) { timerSekunde = maxSekunde; osvjeziPrikaz(); osvjeziRing(); } pokreniTimer(); }
});
document.querySelectorAll('.timer-quick').forEach(function (btn) {
  btn.addEventListener('click', function () {
    timerSekunde += parseInt(btn.dataset.dodaj, 10);
    if (timerSekunde > maxSekunde) maxSekunde = timerSekunde;
    osvjeziPrikaz(); osvjeziRing();
  });
});
document.querySelectorAll('.timer-preset').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (timerStanje === 'running') return;
    document.querySelectorAll('.timer-preset').forEach(function (b) { b.classList.remove('aktivan'); });
    btn.classList.add('aktivan');
    timerSekunde = parseInt(btn.dataset.preset, 10); maxSekunde = timerSekunde;
    timerStanje = 'idle'; osvjeziPrikaz(); osvjeziRing(); osvjeziGumb();
  });
});
elReset.addEventListener('click', resetirajTimer);

document.getElementById('timer-skip-odmor').addEventListener('click', function () {
  clearInterval(timerInterval); timerInterval = null;
  timerStanje = 'done'; timerSekunde = 0;
  zaustaviDah(); osvjeziPrikaz(); osvjeziRing(); osvjeziGumb();
  prikaziCheckin();
});

elBtnOsvj.addEventListener('click', function () {
  elCheckin.classList.add('skriveno');
  elUmorTip.classList.remove('skriveno');
  zaklj = false;
  elInput.disabled = false; elDodaj.disabled = false;
  elLista.classList.remove('zakljucano');
  setTimeout(function () {
    elUmorTip.style.opacity = '0';
    setTimeout(function () { elUmorTip.classList.add('skriveno'); elUmorTip.style.opacity = ''; }, 400);
  }, 5000);
});

elBtnJosOdm.addEventListener('click', function () {
  elCheckin.classList.add('skriveno');
  elLockBanner.style.display = '';
  elLockBanner.style.opacity = '1';
  elLockBanner.classList.remove('otklj');
  elLockIkona.textContent  = '🔒';
  elLockPoruka.textContent = 'Pokreni odmor da otključaš zadatke';
  resetirajTimer();
});

osvjeziPrikaz(); osvjeziRing(); osvjeziGumb();

var zadaci     = JSON.parse(sessionStorage.getItem('umor-zadaci')) || [];
var aktivniIdx = null;

function spremiZadatke() { sessionStorage.setItem('umor-zadaci', JSON.stringify(zadaci)); }

function osvjeziProgress() {
  if (zadaci.length === 0) { elProgressW.style.display = 'none'; return; }
  elProgressW.style.display = 'flex';
  var n = zadaci.filter(function (z) { return z.zavrsen; }).length;
  elProgressF.style.width  = (n / zadaci.length * 100) + '%';
  elProgressT.textContent  = n + '/' + zadaci.length;
}

function renderLista() {
  elLista.innerHTML = '';
  if (zadaci.length === 0) {
    elLista.innerHTML = '<li class="todo-prazno">Nema zadataka — dodaj lakše zadatke nakon odmora.</li>';
    osvjeziProgress(); return;
  }
  zadaci.forEach(function (z, i) {
    var li = document.createElement('li');
    li.className = 'todo-item' + (z.zavrsen ? ' todo-item--done' : '') + (aktivniIdx === i ? ' todo-item--active' : '');
    var check = document.createElement('button');
    check.className = 'todo-check';
    check.innerHTML = z.zavrsen
      ? '<svg viewBox="0 0 24 24" fill="none"><polyline points="5,12 10,17 19,7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none"></svg>';
    check.addEventListener('click', function (e) {
      e.stopPropagation(); if (zaklj) return;
      zadaci[i].zavrsen = !zadaci[i].zavrsen; spremiZadatke(); renderLista(); osvjeziBar();
    });
    var tekst = document.createElement('span');
    tekst.className = 'todo-tekst'; tekst.textContent = z.tekst;
    var del = document.createElement('button');
    del.className = 'todo-delete';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    del.addEventListener('click', function (e) {
      e.stopPropagation(); if (zaklj) return;
      if (aktivniIdx === i) aktivniIdx = null;
      else if (aktivniIdx !== null && aktivniIdx > i) aktivniIdx--;
      zadaci.splice(i, 1); spremiZadatke(); renderLista(); osvjeziBar();
    });
    li.addEventListener('click', function () {
      if (zaklj) return; aktivniIdx = aktivniIdx === i ? null : i; renderLista(); osvjeziBar();
    });
    li.appendChild(check); li.appendChild(tekst); li.appendChild(del);
    elLista.appendChild(li);
  });
  osvjeziProgress();
}

function osvjeziBar() {
  if (!zaklj && aktivniIdx !== null && zadaci[aktivniIdx]) {
    var z = zadaci[aktivniIdx];
    elBarNaziv.textContent  = z.tekst;
    elBarStatus.textContent = z.zavrsen ? 'Završeno' : 'U tijeku';
    elBarStatus.className   = 'bar-status ' + (z.zavrsen ? 'bar-status--done' : 'bar-status--active');
    elBar.classList.add('vidljiv');
    document.body.classList.add('bar-aktivan');
  } else {
    elBar.classList.remove('vidljiv');
    document.body.classList.remove('bar-aktivan');
  }
}

function dodajZadatak() {
  if (zaklj) return;
  var t = elInput.value.trim(); if (!t) return;
  zadaci.push({ tekst: t, zavrsen: false }); elInput.value = '';
  spremiZadatke(); renderLista();
}
elDodaj.addEventListener('click', dodajZadatak);
elInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') dodajZadatak(); });
renderLista(); osvjeziBar();