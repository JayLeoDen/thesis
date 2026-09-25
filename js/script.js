document.querySelectorAll('.mode-card').forEach(function (card) {
  card.addEventListener('click', function () {
    var sada = new Date();
    var sesija = {
      mod: card.dataset.mode,
      datum: sada.toISOString().slice(0, 10), 
      pocetak: sada.getTime()                  
    };
    sessionStorage.setItem('trenutnaSesija', JSON.stringify(sesija));
 });
});