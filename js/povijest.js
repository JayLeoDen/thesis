var MODOVI = {
  fokus:           { naziv: 'Fokus',           boja: 'var(--fokus)',  bg: 'var(--fokus-bg)'  },
  umor:            { naziv: 'Umor',            boja: 'var(--umor)',   bg: 'var(--umor-bg)'   },
  preopterecenost: { naziv: 'Preopterećenost', boja: 'var(--preopt)', bg: 'var(--preopt-bg)' },
  motivacija:      { naziv: 'Motivacija',      boja: 'var(--motiv)',  bg: 'var(--motiv-bg)'  }
};

var HR_DANI    = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
var HR_MJESECI = ['sij.', 'velj.', 'ožu.', 'tra.', 'svi.', 'lip.', 'srp.', 'kol.', 'ruj.', 'lis.', 'stu.', 'pro.'];

var sve    = JSON.parse(localStorage.getItem('povijest')) || [];
var period = 'tjedan';

sve.sort(function (a, b) { return b.timestamp - a.timestamp; });

function formatirajDatum(datum) {
  var d = new Date(datum + 'T12:00:00');
  return HR_DANI[d.getDay()] + ', ' + d.getDate() + '. ' + HR_MJESECI[d.getMonth()];
}

function formatirajTrajanje(min) {
  if (!min || min < 1) return '< 1 min';
  if (min < 60) return min + ' min';
  var h = Math.floor(min / 60), m = min % 60;
  return h + 'h' + (m > 0 ? ' ' + m + 'min' : '');
}

function datumPrijeDana(n) {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.getTime();
}

function filtriraneSesije() {
  if (period === 'sve') return sve;
  var odMs = period === 'tjedan' ? datumPrijeDana(6) : datumPrijeDana(29);
  return sve.filter(function (s) { return s.timestamp >= odMs; });
}

function izracunajStreak() {
  var datumiSet = {};
  sve.forEach(function (s) { datumiSet[s.datum] = true; });
  var datumi = Object.keys(datumiSet).sort().reverse();
  if (datumi.length === 0) return 0;

  var dandanas = new Date().toISOString().slice(0, 10);
  var jucer = new Date();
  jucer.setDate(jucer.getDate() - 1);
  jucer = jucer.toISOString().slice(0, 10);

  if (datumi[0] !== dandanas && datumi[0] !== jucer) return 0;

  var streak = 0;
  var provjera = datumi[0];
  for (var i = 0; i < datumi.length; i++) {
    if (datumi[i] === provjera) {
      streak++;
      var d = new Date(provjera + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      provjera = d.toISOString().slice(0, 10);
    } else break;
  }
  return streak;
}

function renderStats() {
  var el      = document.getElementById('pov-stats-row');
  var streakEl = document.getElementById('pov-streak');

  if (sve.length === 0) { el.innerHTML = ''; streakEl.textContent = ''; return; }

  var ukupnoMin = sve.reduce(function (s, x) { return s + (x.trajanje || 0); }, 0);
  var streak    = izracunajStreak();
  var prosjek   = Math.round(ukupnoMin / sve.length);

  var vrijemePoModu = {};
  Object.keys(MODOVI).forEach(function (k) { vrijemePoModu[k] = 0; });
  sve.forEach(function (s) {
    if (vrijemePoModu[s.mod] !== undefined) vrijemePoModu[s.mod] += (s.trajanje || 0);
  });
  var najMod = Object.keys(vrijemePoModu).reduce(function (a, b) {
    return vrijemePoModu[a] >= vrijemePoModu[b] ? a : b;
  });
  var m = MODOVI[najMod];

  streakEl.textContent = streak > 1 ? '\uD83D\uDD25 ' + streak + ' dana niz' : '';

  el.innerHTML =
    '<div class="pov-stat-card">' +
      '<span class="pov-stat-label">Ukupno sesija</span>' +
      '<span class="pov-stat-vrijednost mono">' + sve.length + '</span>' +
    '</div>' +
    '<div class="pov-stat-card">' +
      '<span class="pov-stat-label">Ukupno vrijeme</span>' +
      '<span class="pov-stat-vrijednost">' + formatirajTrajanje(ukupnoMin) + '</span>' +
    '</div>' +
    '<div class="pov-stat-card">' +
      '<span class="pov-stat-label">Najkorišteniji</span>' +
      '<span class="pov-stat-mod-badge" style="color:' + m.boja + ';background:' + m.bg + '">' + m.naziv + '</span>' +
    '</div>' +
    '<div class="pov-stat-card">' +
      '<span class="pov-stat-label">Prosjek / sesija</span>' +
      '<span class="pov-stat-vrijednost mono">' + formatirajTrajanje(prosjek) + '</span>' +
    '</div>';
}

function renderChart() {
  var el     = document.getElementById('pov-chart');
  var sesije = filtriraneSesije();

  if (sesije.length === 0) {
    el.innerHTML = '<p class="pov-chart-prazno">Nema sesija u odabranom periodu.</p>';
    return;
  }

  var vrijemePoModu = {};
  Object.keys(MODOVI).forEach(function (k) { vrijemePoModu[k] = 0; });
  sesije.forEach(function (s) {
    if (vrijemePoModu[s.mod] !== undefined) vrijemePoModu[s.mod] += (s.trajanje || 0);
  });

  var maxVr = Object.keys(vrijemePoModu).reduce(function (mx, k) {
    return Math.max(mx, vrijemePoModu[k]);
  }, 0);

  if (maxVr === 0) {
    el.innerHTML = '<p class="pov-chart-prazno">Nema sesija u odabranom periodu.</p>';
    return;
  }

  el.innerHTML = Object.keys(MODOVI).map(function (mod) {
    var info = MODOVI[mod];
    var min  = vrijemePoModu[mod];
    var pct  = maxVr > 0 ? (min / maxVr * 100) : 0;
    return '<div class="pov-bar-row">' +
      '<span class="pov-bar-label">' + info.naziv + '</span>' +
      '<div class="pov-bar-track">' +
        '<div class="pov-bar-fill" style="width:' + pct + '%;background:' + info.boja + '"></div>' +
      '</div>' +
      '<span class="pov-bar-vrijednost">' + (min > 0 ? formatirajTrajanje(min) : '\u2014') + '</span>' +
    '</div>';
  }).join('');
}

function renderTablica() {
  var tbody  = document.getElementById('pov-tbody');
  var prazno = document.getElementById('pov-prazno');
  var ukupEl = document.getElementById('pov-ukupno');

  ukupEl.textContent = sve.length > 0 ? sve.length + ' sesija' : '';

  if (sve.length === 0) {
    tbody.innerHTML = '';
    prazno.classList.remove('skriveno');
    return;
  }
  prazno.classList.add('skriveno');

  tbody.innerHTML = sve.map(function (s) {
    var info = MODOVI[s.mod] || { naziv: s.mod, boja: 'var(--ink-soft)', bg: 'var(--bg)' };
    return '<tr>' +
      '<td>' + formatirajDatum(s.datum) + '</td>' +
      '<td class="mono">' + (s.vrijemePocetka || '\u2014') + '</td>' +
      '<td><span class="pov-mod-badge" style="color:' + info.boja + ';background:' + info.bg + '">' + info.naziv + '</span></td>' +
      '<td class="mono">' + formatirajTrajanje(s.trajanje) + '</td>' +
    '</tr>';
  }).join('');
}

function render() { renderStats(); renderChart(); renderTablica(); }

document.getElementById('btn-tjedan').addEventListener('click', function () {
  period = 'tjedan';
  document.querySelectorAll('.pov-period-btn').forEach(function (b) { b.classList.remove('aktivan'); });
  this.classList.add('aktivan');
  renderChart();
});
document.getElementById('btn-mjesec').addEventListener('click', function () {
  period = 'mjesec';
  document.querySelectorAll('.pov-period-btn').forEach(function (b) { b.classList.remove('aktivan'); });
  this.classList.add('aktivan');
  renderChart();
});
document.getElementById('btn-sve-vr').addEventListener('click', function () {
  period = 'sve';
  document.querySelectorAll('.pov-period-btn').forEach(function (b) { b.classList.remove('aktivan'); });
  this.classList.add('aktivan');
  renderChart();
});

document.getElementById('btn-brisi').addEventListener('click', function () {
  if (confirm('Jesi li siguran? Ovo \u0107e trajno izbrisati cijelu povijest sesija.')) {
    localStorage.removeItem('povijest');
    sve = [];
    render();
  }
});

render();