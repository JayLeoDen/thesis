var MAX_DATOTEKA = 15 * 1024 * 1024;
var MAX_XML = 4 * 1024 * 1024;
var MAX_STRANICA = 250;
var WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
var DRAWING = 'http://schemas.openxmlformats.org/drawingml/2006/main';
var PPT = 'http://schemas.openxmlformats.org/presentationml/2006/main';
var REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
var PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

class GreskaDokumenta extends Error {}

async function ucitajDokument(datoteka) {
  var nastavak = datoteka.name.split('.').pop().toLowerCase();
  if (!['docx', 'pptx', 'pdf'].includes(nastavak)) {
    throw new GreskaDokumenta('Odaberi dokument u formatu DOCX, PPTX ili PDF.');
  }
  if (!datoteka.size || datoteka.size > MAX_DATOTEKA) {
    throw new GreskaDokumenta('Odaberi neprazan dokument veličine do 15 MB.');
  }

  var jedinice = nastavak === 'pdf' ? await ucitajPdf(datoteka) : await ucitajOffice(datoteka, nastavak);
  if (!jedinice.length) {
    throw new GreskaDokumenta('U dokumentu nema čitljivog teksta. Ako je skeniran, prvo ga pretvori u PDF s prepoznatim tekstom.');
  }
  if (jedinice.reduce(function (zbroj, dio) { return zbroj + dio.tekst.length; }, 0) > 350000) {
    throw new GreskaDokumenta('Dokument ima previše teksta za jedan plan. Učitaj kraću verziju gradiva.');
  }
  return jedinice;
}

function dodajJedinicu(jedinice, izvor, tekst) {
  tekst = tekst.replace(/[^\S\n]+/g, ' ').trim();
  if (tekst) jedinice.push({ izvor: izvor, tekst: tekst });
}

function spojiPdfRetke(tekst) {
  var redovi = [];
  tekst.split('\n').forEach(function (red) {
    red = red.trim();
    if (!red) return;
    var prethodni = redovi.at(-1);
    if (prethodni && !/[.!?:;]$/.test(prethodni) && /^\p{Ll}/u.test(red)) {
      redovi[redovi.length - 1] = prethodni + ' ' + red;
    } else {
      redovi.push(red);
    }
  });
  return redovi.join('\n');
}

async function ucitajPdf(datoteka) {
  var biblioteke = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  var pdfjs = biblioteke[0];
  pdfjs.GlobalWorkerOptions.workerSrc = biblioteke[1].default;

  var dokument = pdfjs.getDocument({ data: await datoteka.arrayBuffer(), isEvalSupported: false });
  try {
    var pdf = await dokument.promise;
    if (pdf.numPages > MAX_STRANICA) throw new GreskaDokumenta('PDF može imati najviše ' + MAX_STRANICA + ' stranica.');

    var jedinice = [];
    var ukupno = 0;
    for (var i = 1; i <= pdf.numPages; i++) {
      var stranica = await pdf.getPage(i);
      var sadrzaj = await stranica.getTextContent();
      var tekst = sadrzaj.items.map(function (stavka) {
        return typeof stavka.str === 'string' ? stavka.str + (stavka.hasEOL ? '\n' : ' ') : '';
      }).join('');
      ukupno += tekst.length;
      if (ukupno > 350000) throw new GreskaDokumenta('PDF ima previše teksta za jedan plan.');
      dodajJedinicu(jedinice, 'Stranica ' + i, spojiPdfRetke(tekst));
      stranica.cleanup();
    }
    return jedinice;
  } catch (greska) {
    if (greska.name === 'PasswordException') throw new GreskaDokumenta('Odaberi PDF koji se može otvoriti bez lozinke.');
    throw greska;
  } finally {
    await dokument.destroy();
  }
}

function elementi(element, prostor, naziv) {
  return Array.from(element.getElementsByTagNameNS(prostor, naziv));
}

function tekstOdlomka(odlomak, prostor) {
  return elementi(odlomak, prostor, '*').filter(function (el) {
    return ['t', 'br', 'cr', 'tab'].includes(el.localName);
  }).map(function (el) {
    if (el.localName === 't') return el.textContent;
    return el.localName === 'tab' ? ' ' : '\n';
  }).join('');
}

async function ucitajXml(unos) {
  if (!unos) throw new GreskaDokumenta('Dokument nema očekivanu unutarnju strukturu.');
  if (unos.uncompressedSize > MAX_XML) throw new GreskaDokumenta('Dio dokumenta je prevelik.');

  var dijelovi = [];
  var velicina = 0;
  var izlaz = new WritableStream({
    write: function (dio) {
      velicina += dio.byteLength;
      if (velicina > MAX_XML) throw new GreskaDokumenta('Dio dokumenta je prevelik.');
      dijelovi.push(dio);
    }
  });
  await unos.getData(izlaz, { useWebWorkers: false, checkSignature: true });
  var tekst = await new Blob(dijelovi).text();
  if (/<!DOCTYPE/i.test(tekst)) throw new GreskaDokumenta('Dokument sadrži nepodržanu XML strukturu.');
  var xml = new DOMParser().parseFromString(tekst, 'application/xml');
  if (xml.querySelector('parsererror')) throw new GreskaDokumenta('Tekst dokumenta nije čitljiv.');
  return xml;
}

async function ucitajOffice(datoteka, nastavak) {
  var zip = await import('@zip.js/zip.js');
  var citac = new zip.ZipReader(new zip.BlobReader(datoteka));
  try {
    var unosi = new Map();
    for await (var unos of citac.getEntriesGenerator()) {
      if (unosi.size >= 3000) throw new GreskaDokumenta('Dokument sadrži previše unutarnjih dijelova.');
      unosi.set(unos.filename, unos);
    }
    return nastavak === 'docx' ? await procitajWord(unosi) : await procitajPrezentaciju(unosi);
  } finally {
    await citac.close();
  }
}

async function procitajWord(unosi) {
  var xml = await ucitajXml(unosi.get('word/document.xml'));
  var jedinice = [];
  elementi(xml, WORD, 'p').forEach(function (odlomak, i) {
    dodajJedinicu(jedinice, 'Odlomak ' + (i + 1), tekstOdlomka(odlomak, WORD));
  });
  return jedinice;
}

async function procitajPrezentaciju(unosi) {
  var prezentacija = await ucitajXml(unosi.get('ppt/presentation.xml'));
  var veze = await ucitajXml(unosi.get('ppt/_rels/presentation.xml.rels'));
  var popis = elementi(prezentacija, PPT, 'sldId');
  var putanje = new Map(elementi(veze, PACKAGE_REL, 'Relationship').map(function (veza) {
    return [veza.getAttribute('Id'), veza.getAttribute('Target')];
  }));
  if (popis.length > MAX_STRANICA) throw new GreskaDokumenta('Prezentacija može imati najviše ' + MAX_STRANICA + ' slajdova.');

  var jedinice = [];
  var ukupno = 0;
  for (var i = 0; i < popis.length; i++) {
    var cilj = putanje.get(popis[i].getAttributeNS(REL, 'id')) || '';
    var putanja = cilj.startsWith('/') ? cilj.slice(1) : 'ppt/' + cilj;
    if (!/^ppt\/slides\/[^/]+\.xml$/.test(putanja)) throw new GreskaDokumenta('Prezentacija sadrži nečitljiv slajd.');
    var slajd = await ucitajXml(unosi.get(putanja));
    var tekst = elementi(slajd, DRAWING, 'p').map(function (odlomak) {
      return tekstOdlomka(odlomak, DRAWING);
    }).join('\n');
    ukupno += tekst.length;
    if (ukupno > 350000) throw new GreskaDokumenta('Prezentacija ima previše teksta za jedan plan.');
    dodajJedinicu(jedinice, 'Slajd ' + (i + 1), tekst);
  }
  return jedinice;
}

export { GreskaDokumenta, ucitajDokument };
