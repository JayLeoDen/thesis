(function () {
  var poruke = [
    "Svaki veliki pothvat počinje jednim malim korakom.",
    "Ne moraš biti savršen, samo moraš početi.",
    "Tvoja jedina konkurencija si ti od jučer.",
    "Mali napredak je i dalje napredak.",
    "Koncentracija je tajna uspjeha.",
    "Učenje je dar koji sam sebi možeš dati.",
    "Sve što vrijedi zahtijeva trud i strpljenje.",
    "Danas je savršen dan za učenje nečeg novog.",
    "Fokusiraj se na put, ne samo na cilj.",
    "Tvoja upornost je tvoja najjača osobina.",
    "Teško u učenju, lako u djelu.",
    "Svaka minuta učenja je ulaganje u sebe.",
    "Zamori se od nicanja, a ne od sjedenja."
  ];

  var kutija = document.getElementById('quotes-box');
  if (!kutija) return;

  var tekst = document.createElement('p');
  tekst.className = 'quotes-tekst';

  kutija.appendChild(tekst);

  var trenutni = Math.floor(Math.random() * poruke.length);
  tekst.textContent = poruke[trenutni];

  setInterval(function () {
    tekst.classList.add('fade');
    setTimeout(function () {
      trenutni = (trenutni + 1) % poruke.length;
      tekst.textContent = poruke[trenutni];
      tekst.classList.remove('fade');
    }, 520);
  }, 6000);
})();