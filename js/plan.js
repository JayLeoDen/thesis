var MODOVI = {
  fokus: { naziv: 'Fokus', omjer: 1, podrska: 'Riješi cijeli korak pa ukratko provjeri svoj odgovor.' },
  umor: { naziv: 'Umor', omjer: 0.6, podrska: 'Zapiši kratak odgovor. Uzmi predah prije sljedećeg koraka ako ti treba.' },
  preopterecenost: { naziv: 'Preopterećenost', omjer: 0.75, podrska: 'Zadrži se na otvorenom koraku. Ostale možeš pregledati poslije.' },
  motivacija: { naziv: 'Slaba motivacija', omjer: 0.7, podrska: 'Za početak zapiši prvu riječ ili ideju koja ti padne na pamet.' }
};

var CILJEVI = {
  razumijevanje: 'Razumijevanje gradiva',
  ponavljanje: 'Priprema za ispit',
  zadaci: 'Zadaci iz dokumenta'
};

var NAREDBA = /^(?:(?:zadatak|pitanje)\s*\d*\s*[:.)]\s*)?(?:(?:\d+[.)]|[a-z]\)|[•–-])\s*)?(?:objasni(?:te)?|navedi(?:te)?|nabroji(?:te)?|opiši|opišite|definiraj(?:te)?|usporedi(?:te)?|izračunaj(?:te)?|odredi(?:te)?|riješi(?:te)?|obrazloži(?:te)?|dokaži(?:te)?|prikaži(?:te)?|izradi(?:te)?|napiši|napišite|zaokruži(?:te)?|poveži(?:te)?|primijeni(?:te)?)(?:\s|:)/iu;
var SEGMENTER = new Intl.Segmenter('hr', { granularity: 'sentence' });

function razvrstajGradivo(jedinice) {
  var pitanja = [];
  var gradivo = [];
  var vidjeno = new Set();

  jedinice.forEach(function (jedinica) {
    var tekst = jedinica.tekst;
    var recenice = [];
    tekst.split('\n').forEach(function (red) {
      Array.from(SEGMENTER.segment(red)).forEach(function (dio) {
        var recenica = dio.segment.trim();
        if (!recenica) return;
        recenice.push(recenica);

        if (recenica.length < 8 || (!recenica.endsWith('?') && !NAREDBA.test(recenica))) return;
        var kljuc = recenica.toLocaleLowerCase('hr').replace(/^\d+[.)]\s*/, '');
        if (vidjeno.has(kljuc)) return;
        vidjeno.add(kljuc);
        var pocetak = tekst.indexOf(red);
        pitanja.push({
          izvor: jedinica.izvor,
          tekst: recenica.slice(0, 750),
          kontekst: tekst.slice(Math.max(0, pocetak - 160), pocetak + 590).trim()
        });
      });
    });

    var isjecak = '';
    recenice.forEach(function (recenica) {
      if (isjecak && isjecak.length + recenica.length > 650) {
        gradivo.push({ izvor: jedinica.izvor, tekst: isjecak });
        isjecak = '';
      }
      isjecak += (isjecak ? ' ' : '') + recenica.slice(0, 750);
    });
    if (isjecak.length >= 20) gradivo.push({ izvor: jedinica.izvor, tekst: isjecak });
  });

  return { pitanja: pitanja, gradivo: gradivo };
}

function preporuciMod(stanje, cilj, minute, znakovi, pitanja) {
  if (Object.hasOwn(MODOVI, stanje)) {
    return { mod: stanje, razlog: 'Način rada prilagođen je stanju koje si odabrao.' };
  }
  if ((minute <= 20 && (znakovi >= 9000 || pitanja >= 12)) || znakovi >= 22000) {
    return { mod: 'preopterecenost', razlog: 'Opseg gradiva je velik za ovu sesiju. Plan izdvaja nekoliko dijelova dokumenta i prikazuje ih korak po korak.' };
  }
  if (minute === 10) {
    return { mod: 'motivacija', razlog: 'Za 10 minuta predloženi su kratki koraci s jednostavnim početkom.' };
  }
  var razlog = cilj === 'zadaci' && pitanja > 0
    ? 'Plan daje prednost pitanjima i uputama prepoznatima u dokumentu.'
    : 'Plan raspoređuje odabrane dijelove gradiva prema tvojem cilju i raspoloživom vremenu.';
  return { mod: 'fokus', razlog: razlog };
}

function odaberiStavke(stavke, broj) {
  if (broj <= 0) return [];
  if (stavke.length <= broj) return stavke;
  if (broj === 1) return [stavke[0]];
  return Array.from({ length: broj }, function (_, i) {
    return stavke[Math.round(i * (stavke.length - 1) / (broj - 1))];
  });
}

function uputaZaGradivo(cilj, mod, indeks, tekst) {
  var definicija = tekst.match(/^([\p{L}][\p{L}\d /-]{1,62}?)\s+(?:je|su|služi za|označava|predstavlja|refers to|is|are)\s+\S/iu);
  var pojam = definicija ? definicija[1] : '';
  if (pojam && cilj === 'ponavljanje') return 'Objasni pojam „' + pojam + '” iz sjećanja pa provjeri isječak.';
  if (pojam && cilj === 'razumijevanje') {
    return 'Objasni pojam „' + pojam + '” svojim riječima' + (mod === 'umor' ? '.' : ' i navedi primjer.');
  }
  if (mod === 'umor') return 'Pročitaj isječak i zapiši glavnu misao.';
  if (cilj === 'ponavljanje') return indeks % 2 === 0
    ? 'Pročitaj isječak, zatvori ga i prepričaj bez gledanja.'
    : 'Sastavi kratko ispitno pitanje iz isječka i odgovori iz sjećanja.';
  if (cilj === 'zadaci') return 'Pronađi pravilo ili pojam iz isječka i primijeni ga na vlastitom primjeru.';
  return indeks % 2 === 0
    ? 'Izdvoji glavni pojam iz isječka i objasni ga svojim riječima.'
    : 'Poveži ideju iz isječka s jednim konkretnim primjerom.';
}

function izradiPlan(jedinice, naziv, cilj, minute, stanje) {
  var gradivo = razvrstajGradivo(jedinice);
  var znakovi = jedinice.reduce(function (ukupno, jedinica) { return ukupno + jedinica.tekst.length; }, 0);
  var preporuka = preporuciMod(stanje, cilj, minute, znakovi, gradivo.pitanja.length);
  var broj = Math.max(2, Math.min(10, Math.floor(minute / 5 * MODOVI[preporuka.mod].omjer)));
  var brojPitanja = cilj === 'zadaci' ? broj : Math.floor(broj / 2);
  var pitanja = odaberiStavke(gradivo.pitanja, brojPitanja);
  var dijelovi = gradivo.gradivo.length ? gradivo.gradivo : jedinice;
  var gradivoZaRad = dijelovi.filter(function (dio) {
    return !pitanja.some(function (pitanje) { return dio.izvor === pitanje.izvor && dio.tekst.trim() === pitanje.tekst; });
  });

  var zadaci = pitanja.map(function (pitanje) {
    return { izvor: pitanje.izvor, tekst: pitanje.kontekst, uputa: pitanje.tekst };
  }).concat(odaberiStavke(gradivoZaRad, broj - pitanja.length).map(function (dio, i) {
    return { izvor: dio.izvor, tekst: dio.tekst.slice(0, 750), uputa: uputaZaGradivo(cilj, preporuka.mod, i, dio.tekst) };
  }));

  if (cilj === 'zadaci' && !pitanja.length) {
    preporuka.razlog += ' U tekstu nisu prepoznate izravne upute ni pitanja. Koraci se temelje na isječcima gradiva.';
  }

  return {
    naziv: naziv.slice(0, 240),
    mod: preporuka.mod,
    cilj: cilj,
    minute: minute,
    razlog: preporuka.razlog,
    zadaci: zadaci,
    dovrseni: []
  };
}

export { MODOVI, CILJEVI, izradiPlan };
