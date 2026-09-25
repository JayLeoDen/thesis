var sesija = JSON.parse(sessionStorage.getItem('trenutnaSesija')) || null;
if (!sesija || sesija.mod !== 'preopterecenost') {
  sesija = { mod: 'preopterecenost', datum: new Date().toISOString().slice(0, 10), pocetak: Date.now() };
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
  povijest.push({ mod: 'preopterecenost', datum: sesija.datum, vrijemePocetka: vp, trajanje: t, timestamp: Date.now() });
  localStorage.setItem('povijest', JSON.stringify(povijest));
  sessionStorage.removeItem('trenutnaSesija');
});

var elPlaniranje   = document.getElementById('planiranje-view');
var elFokusView    = document.getElementById('fokus-view');
var elInput        = document.getElementById('todo-input');
var elDodaj        = document.getElementById('todo-dodaj');
var elLista        = document.getElementById('todo-lista');
var elGreska       = document.getElementById('preopt-greska');
var elBtnKreni     = document.getElementById('btn-kreni');
var elZadatakCard  = document.getElementById('zadatak-card');
var elDoneScreen   = document.getElementById('done-screen');
var elZadatakNaziv = document.getElementById('zadatak-naziv');
var elProgFill     = document.getElementById('prog-fill');
var elProgTekst    = document.getElementById('prog-tekst');
var elBtnZavrsio   = document.getElementById('btn-zavrsio');
var elBtnIduci     = document.getElementById('btn-iduci');
var elBtnNatrag    = document.getElementById('btn-natrag');
var elBtnNovaLista = document.getElementById('btn-nova-lista');
var elBar          = document.getElementById('trenutni-bar');
var elBarNaziv     = document.getElementById('bar-naziv');
var elBarStatus    = document.getElementById('bar-status');

var zadaci     = JSON.parse(sessionStorage.getItem('preopt-zadaci')) || [];
var redCekanja = [];
var aktivniIdx = null;

function spremiZadatke() { sessionStorage.setItem('preopt-zadaci', JSON.stringify(zadaci)); }

function osvjeziBar() {
  if (aktivniIdx !== null && zadaci[aktivniIdx]) {
    var z = zadaci[aktivniIdx];
    elBarNaziv.textContent  = z.tekst;
    elBarStatus.textContent = z.zavrsen ? 'Završeno' : 'Na listi';
    elBarStatus.className   = 'bar-status ' + (z.zavrsen ? 'bar-status--done' : 'bar-status--active');
    elBar.classList.add('vidljiv');
    document.body.classList.add('bar-aktivan');
  } else {
    elBar.classList.remove('vidljiv');
    document.body.classList.remove('bar-aktivan');
  }
}

function renderLista() {
  elLista.innerHTML = '';
  if (zadaci.length === 0) {
    elLista.innerHTML = '<li class="todo-prazno">Napiši sve što te muči — bez filtriranja.</li>';
    return;
  }
  zadaci.forEach(function (z, i) {
    var li = document.createElement('li');
    li.className = 'todo-item'
      + (z.zavrsen    ? ' todo-item--done'   : '')
      + (aktivniIdx === i ? ' todo-item--active' : '');

    var check = document.createElement('button');
    check.className = 'todo-check';
    check.innerHTML = z.zavrsen
      ? '<svg viewBox="0 0 24 24" fill="none"><polyline points="5,12 10,17 19,7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none"></svg>';
    check.addEventListener('click', function (e) {
      e.stopPropagation();
      zadaci[i].zavrsen = !zadaci[i].zavrsen;
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
      zadaci.splice(i, 1);
      spremiZadatke(); renderLista(); osvjeziBar();
    });

    li.addEventListener('click', function () {
      aktivniIdx = aktivniIdx === i ? null : i;
      renderLista(); osvjeziBar();
    });

    li.appendChild(check); li.appendChild(tekst); li.appendChild(del);
    elLista.appendChild(li);
  });
}

function dodajZadatak() {
  var t = elInput.value.trim(); if (!t) return;
  zadaci.push({ tekst: t, zavrsen: false }); elInput.value = '';
  spremiZadatke(); renderLista(); elGreska.classList.add('skriveno');
}
elDodaj.addEventListener('click', dodajZadatak);
elInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') dodajZadatak(); });

elBtnKreni.addEventListener('click', function () {
  var nez = zadaci.filter(function (z) { return !z.zavrsen; });
  if (zadaci.length === 0) {
    elGreska.textContent = 'Dodaj barem jedan zadatak za početak.';
    elGreska.classList.remove('skriveno'); return;
  }
  if (nez.length === 0) {
    elGreska.textContent = 'Svi zadaci su završeni. Dodaj nove ili pritisni "Nova lista".';
    elGreska.classList.remove('skriveno'); return;
  }
  ulazFaza();
});

function azurirajProgress() {
  var uk  = zadaci.length;
  var zav = zadaci.filter(function (z) { return z.zavrsen; }).length;
  elProgFill.style.width  = (zav / uk * 100) + '%';
  elProgTekst.textContent = zav + '/' + uk;
}

function prikaziTrenutniZadatak() {
  if (redCekanja.length === 0) { prikaziDoneScreen(); return; }
  var idx = redCekanja[0];
  elZadatakCard.style.opacity   = '0';
  elZadatakCard.style.transform = 'translateY(10px)';
  setTimeout(function () {
    elZadatakNaziv.textContent    = zadaci[idx].tekst;
    elZadatakCard.style.opacity   = '1';
    elZadatakCard.style.transform = 'translateY(0)';
  }, 260);
  azurirajProgress();
}

function prikaziDoneScreen() {
  elZadatakCard.classList.add('skriveno');
  elDoneScreen.classList.remove('skriveno');
  azurirajProgress();
}

function ulazFaza() {
  redCekanja = zadaci.map(function (z, i) { return i; }).filter(function (i) { return !zadaci[i].zavrsen; });
  aktivniIdx = null;
  elBar.classList.remove('vidljiv');
  document.body.classList.remove('bar-aktivan');
  elPlaniranje.classList.add('skriveno');
  elFokusView.classList.remove('skriveno');
  elZadatakCard.classList.remove('skriveno');
  elDoneScreen.classList.add('skriveno');
  elZadatakCard.style.opacity   = '1';
  elZadatakCard.style.transform = 'translateY(0)';
  prikaziTrenutniZadatak();
}

elBtnZavrsio.addEventListener('click', function () {
  var idx = redCekanja.shift();
  zadaci[idx].zavrsen = true; spremiZadatke(); prikaziTrenutniZadatak();
});
elBtnIduci.addEventListener('click', function () {
  var idx = redCekanja.shift(); redCekanja.push(idx); prikaziTrenutniZadatak();
});
elBtnNatrag.addEventListener('click', function () {
  elFokusView.classList.add('skriveno');
  elPlaniranje.classList.remove('skriveno');
  renderLista(); osvjeziBar();
});
elBtnNovaLista.addEventListener('click', function () {
  zadaci = []; spremiZadatke(); redCekanja = []; aktivniIdx = null;
  elFokusView.classList.add('skriveno');
  elPlaniranje.classList.remove('skriveno');
  renderLista(); osvjeziBar();
});

renderLista(); osvjeziBar();