# Plan učenja

Aplikacija iz Worda (.docx), PowerPointa (.pptx) ili PDF-a s čitljivim tekstom
izdvaja pitanja, upute i dijelove gradiva. Preporuka se temelji na količini
teksta, broju prepoznatih pitanja, cilju, raspoloživom vremenu i stanju koje
korisnik navede. Korisnik može dovršiti korak ili mu se vratiti kasnije.

Dokument se obrađuje u pregledniku i izvorna datoteka ostaje na uređaju.
Express povezuje preglednik s MariaDB bazom. Nakon prijave korisnik može
spremiti plan s odabranim isječcima i nastaviti rad na drugom uređaju.
Stare sesije iz izvorne verzije ostaju vidljive u pregledniku na istoj adresi.

## Pokretanje

Uz Node.js 22.13 ili noviji:

```bash
npm ci
npm run dev
```

Otvori `http://localhost:5173`. Izrada plana radi i bez postavljene baze.

## Povezivanje s udaljenom MariaDB bazom

Trebaš adresu poslužitelja, port, naziv dodijeljene baze, korisničko ime i
lozinku, primjerice s fakultetskog ili drugog poslužitelja. Express mora imati
mrežni pristup adresi baze. Ako već imaš
dodijeljenu bazu, možeš je koristiti izravno. Ako upravljaš poslužiteljem i
želiš novu bazu, kao administrator pokreni:

```sql
CREATE DATABASE plan_ucenja CHARACTER SET utf8mb4;
```

Kopiraj `.env.example` u `.env.local` i upiši `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD` i `DB_NAME`. Kad poslužitelj zahtijeva TLS, postavi
`DB_TLS=true`. Ako administrator baze isporuči vlastiti CA certifikat, u
`DB_SSL_CA_FILE` upiši put do PEM datoteke.

```bash
npm run db:init
npm run dev
```

`db:init` učitava [server/shema.sql](server/shema.sql) i izrađuje tablice ako
već ne postoje. Ako aplikacijski račun nema dopuštenje `CREATE`, administrator
baze može izvršiti tu SQL skriptu u dodijeljenoj bazi. Skriptu možeš izvršiti
i iz kartice **Query** u HeidiSQL-u nakon što odabereš dodijeljenu bazu.
Ako si tablice izradio u HeidiSQL-u, preskoči `npm run db:init`.

Projekt koristi tablice `plan_ucenja_korisnici`, `plan_ucenja_sesije`,
`plan_ucenja_planovi`, `plan_ucenja_koraci` i `plan_ucenja_obnova_lozinke`.
Prije prvog uvoza u zajedničku bazu provjeri da ti nazivi nisu zauzeti.
Prijava koristi
`scrypt` za sažetak lozinke i sesijski kolačić koji JavaScript u pregledniku
ne može čitati. Svaki zahtjev za čitanje ili izmjenu plana provjerava vlasnika.
Plan i njegovi koraci upisuju se u jednoj transakciji.

## Uloge i administracija

Na postojećoj bazi izvrši `server/uloge.sql` ili ponovno pokreni
`npm run db:init`. Postojeći računi dobivaju ulogu korisnika, a spremljeni
planovi ostaju povezani s istim računima.

Za prvog administratora prvo izradi račun kroz aplikaciju. Zatim izvrši ovaj
upit u dodijeljenoj bazi i zamijeni e-adresu adresom tog računa:

```sql
UPDATE plan_ucenja_korisnici
SET uloga = 'admin'
WHERE email = 'tvoja-adresa@example.com';
```

Nakon ponovne prijave otvorit će se mogućnost **Administracija**.
Administrator može izrađivati i uređivati račune, mijenjati uloge i lozinke,
brisati račune te upravljati planovima svih korisnika. Brisanje korisničkog
računa uklanja njegove planove, a promjena pristupnih podataka prekida
postojeće sesije. Sustav mora zadržati barem jednog administratora.
Korisnici imaju pristup vlastitim spremljenim planovima.

## Obnova lozinke

Za slanje poveznice e-poštom u `.env.local` upiši javnu adresu aplikacije u
`APP_URL` te postavke svojeg poslužitelja za e-poštu u polja `SMTP_*`.
Za port 465 s TLS-om od početka veze postavi `SMTP_SECURE=true`. Za port
587 sa STARTTLS-om ostavi `SMTP_SECURE=false`.

## Objava

```bash
npm run build
npm start
```

Node.js poslužitelj poslužuje i aplikaciju i API na istom portu, zadano
`3000`. U produkciji koristi HTTPS. Ako je aplikacija iza jednog obrnutog
proxyja koji postavlja zaglavlja prosljeđivanja, postavi `TRUST_PROXY=1`.
Za isključivo lokalnu provjeru produkcijske verzije preko HTTP-a možeš
postaviti `COOKIE_SECURE=false` u `.env.local`.
