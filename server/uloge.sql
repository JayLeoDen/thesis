ALTER TABLE plan_ucenja_korisnici
  ADD COLUMN IF NOT EXISTS uloga ENUM('korisnik', 'admin') NOT NULL DEFAULT 'korisnik';
