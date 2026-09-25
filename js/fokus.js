var ZADANO_VRIJEME = 25 * 60;
var RING_CIRC = 2 * Math.PI * 90;

var sesija = JSON.parse(sessionStorage.getItem('trenutnaSesija')) || null;
if (!sesija || sesija.mod !== 'fokus') {
  sesija = { mod: 'fokus', datum: new Date().toISOString().slice(0, 10), pocetak: Date.now() };
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
  povijest.push({ mod: 'fokus', datum: sesija.datum, vrijemePocetka: vp, trajanje: t, timestamp: Date.now() });
  localStorage.setItem('povijest', JSON.stringify(povijest));
  sessionStorage.removeItem('trenutnaSesija');
});

var timerSekunde = ZADANO_VRIJEME;
var maxSekunde   = ZADANO_VRIJEME;
var timerInterval = null;
var timerStanje  = 'idle';

var elPrikaz  = document.getElementById('timer-prikaz');
var elSub     = document.getElementById('timer-sub');
var elGumb    = document.getElementById('timer-gumb');
var elIkona   = document.getElementById('timer-ikona');
var elGumbTxt = document.getElementById('timer-gumb-tekst');
var elReset   = document.getElementById('timer-reset');
var elRing    = document.getElementById('ring-progress');

elRing.style.strokeDasharray  = RING_CIRC;
elRing.style.strokeDashoffset = 0;

function formatiraj(sec) {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}
function osvjeziPrikaz() {
  elPrikaz.textContent = formatiraj(timerSekunde);
  elSub.textContent = timerSekunde % 60 === 0 ? 'minuta' : 'preostalo';
}
function osvjeziRing() {
  var p = maxSekunde > 0 ? timerSekunde / maxSekunde : 1;
  elRing.style.strokeDashoffset = RING_CIRC * (1 - p);
  elRing.style.stroke = timerSekunde <= 0 ? 'var(--umor)' : 'var(--fokus)';
}
function osvjeziGumb() {
  if (timerStanje === 'running') {
    elIkona.innerHTML = '<rect x="5" y="4" width="4" height="16" rx="1.5" fill="white"/><rect x="15" y="4" width="4" height="16" rx="1.5" fill="white"/>';
    elGumbTxt.textContent = 'Pauziraj';
    elPrikaz.classList.add('running');
  } else {
    elIkona.innerHTML = '<polygon points="6,4 20,12 6,20" fill="white"/>';
    elGumbTxt.textContent = timerStanje === 'paused' ? 'Nastavi' : timerSekunde <= 0 ? 'Pokreni ponovo' : 'Pokreni';
    elPrikaz.classList.remove('running');
  }
}
function pokreniTimer() {
  timerStanje = 'running'; osvjeziGumb();
  timerInterval = setInterval(function () {
    if (timerSekunde <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      timerStanje = 'done';
      osvjeziPrikaz(); osvjeziRing(); osvjeziGumb(); return;
    }
    timerSekunde--; osvjeziPrikaz(); osvjeziRing();
  }, 1000);
}
function zaustaviTimer() {
  clearInterval(timerInterval); timerInterval = null;
  timerStanje = 'paused'; osvjeziGumb();
}
function resetirajTimer() {
  clearInterval(timerInterval); timerInterval = null;
  timerStanje = 'idle'; timerSekunde = maxSekunde;
  osvjeziPrikaz(); osvjeziRing(); osvjeziGumb();
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
osvjeziPrikaz(); osvjeziRing(); osvjeziGumb();

var zadaci     = JSON.parse(sessionStorage.getItem('fokus-zadaci')) || [];
var aktivniIdx = null;

var elInput      = document.getElementById('todo-input');
var elDodaj      = document.getElementById('todo-dodaj');
var elLista      = document.getElementById('todo-lista');
var elBar        = document.getElementById('trenutni-bar');
var elBarNaziv   = document.getElementById('bar-naziv');
var elBarStatus  = document.getElementById('bar-status');
var elProgressW  = document.getElementById('todo-progress-wrap');
var elProgressF  = document.getElementById('todo-progress-fill');
var elProgressT  = document.getElementById('todo-progress-tekst');

function spremiZadatke() { sessionStorage.setItem('fokus-zadaci', JSON.stringify(zadaci)); }

function osvjeziProgress() {
  if (zadaci.length === 0) { elProgressW.style.display = 'none'; return; }
  elProgressW.style.display = 'flex';
  var n = zadaci.filter(function (z) { return z.zavrsen; }).length;
  elProgressF.style.width = (n / zadaci.length * 100) + '%';
  elProgressT.textContent = n + '/' + zadaci.length;
}

function renderLista() {
  elLista.innerHTML = '';
  if (zadaci.length === 0) {
    elLista.innerHTML = '<li class="todo-prazno">Nema zadataka — dodaj prvi iznad.</li>';
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
      e.stopPropagation(); zadaci[i].zavrsen = !zadaci[i].zavrsen;
      spremiZadatke(); renderLista(); osvjeziBar();
    });
    var tekst = document.createElement('span');
    tekst.className = 'todo-tekst'; tekst.textContent = z.tekst;
    var del = document.createElement('button');
    del.className = 'todo-delete';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      if (aktivniIdx === i) aktivniIdx = null;
      else if (aktivniIdx !== null && aktivniIdx > i) aktivniIdx--;
      zadaci.splice(i, 1); spremiZadatke(); renderLista(); osvjeziBar();
    });
    li.addEventListener('click', function () { aktivniIdx = aktivniIdx === i ? null : i; renderLista(); osvjeziBar(); });
    li.appendChild(check); li.appendChild(tekst); li.appendChild(del);
    elLista.appendChild(li);
  });
  osvjeziProgress();
}

function osvjeziBar() {
  if (aktivniIdx !== null && zadaci[aktivniIdx]) {
    var z = zadaci[aktivniIdx];
    elBarNaziv.textContent = z.tekst;
    elBarStatus.textContent = z.zavrsen ? 'Završeno' : 'U tijeku';
    elBarStatus.className = 'bar-status ' + (z.zavrsen ? 'bar-status--done' : 'bar-status--active');
    elBar.classList.add('vidljiv');
    document.body.classList.add('bar-aktivan');
  } else {
    elBar.classList.remove('vidljiv');
    document.body.classList.remove('bar-aktivan');
  }
}

function dodajZadatak() {
  var t = elInput.value.trim(); if (!t) return;
  zadaci.push({ tekst: t, zavrsen: false }); elInput.value = '';
  spremiZadatke(); renderLista();
}
elDodaj.addEventListener('click', dodajZadatak);
elInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') dodajZadatak(); });
renderLista(); osvjeziBar();