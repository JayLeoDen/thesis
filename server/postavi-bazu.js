import { readFile } from 'node:fs/promises';
import { baza } from './baza.js';

if (!baza) {
  console.error('U .env.local upiši podatke za spajanje s MariaDB bazom.');
  process.exitCode = 1;
} else {
  try {
    for (var naziv of ['shema.sql', 'uloge.sql']) {
      var skripta = await readFile(new URL(naziv, import.meta.url), 'utf8');
      for (var naredba of skripta.split(';').map(function (dio) { return dio.trim(); }).filter(Boolean)) {
        await baza.query(naredba);
      }
    }
    console.log('Tablice su spremne.');
  } catch (greska) {
    console.error('Izrada tablica nije uspjela.', greska.code || greska.message);
    process.exitCode = 1;
  } finally {
    await baza.end();
  }
}
