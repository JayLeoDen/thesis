CREATE TABLE IF NOT EXISTS plan_ucenja_korisnici (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  lozinka_hash VARCHAR(200) NOT NULL,
  uloga ENUM('korisnik', 'admin') NOT NULL DEFAULT 'korisnik'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS plan_ucenja_sesije (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  korisnik_id INT UNSIGNED NOT NULL,
  vrijedi_do DATETIME NOT NULL,
  INDEX (vrijedi_do),
  FOREIGN KEY (korisnik_id) REFERENCES plan_ucenja_korisnici(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_ucenja_planovi (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  korisnik_id INT UNSIGNED NOT NULL,
  naziv VARCHAR(240) NOT NULL,
  nacin ENUM('fokus', 'umor', 'preopterecenost', 'motivacija') NOT NULL,
  cilj ENUM('razumijevanje', 'ponavljanje', 'zadaci') NOT NULL,
  minute TINYINT UNSIGNED NOT NULL CHECK (minute IN (10, 20, 35, 50)),
  razlog VARCHAR(300) NOT NULL,
  stvoren DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX (korisnik_id, stvoren),
  FOREIGN KEY (korisnik_id) REFERENCES plan_ucenja_korisnici(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_ucenja_koraci (
  plan_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  redni_broj TINYINT UNSIGNED NOT NULL CHECK (redni_broj < 10),
  izvor VARCHAR(100) NOT NULL,
  uputa VARCHAR(750) NOT NULL,
  tekst VARCHAR(750) NOT NULL,
  dovrsen TINYINT UNSIGNED NOT NULL DEFAULT 0 CHECK (dovrsen IN (0, 1)),
  PRIMARY KEY (plan_id, redni_broj),
  FOREIGN KEY (plan_id) REFERENCES plan_ucenja_planovi(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_ucenja_obnova_lozinke (
  korisnik_id INT UNSIGNED PRIMARY KEY,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  vrijedi_do DATETIME NOT NULL,
  FOREIGN KEY (korisnik_id) REFERENCES plan_ucenja_korisnici(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
