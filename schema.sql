-- Dilam B' — schéma D1 (idempotent : peut être rejoué sans risque)

-- Documents applicatifs (livres, configuration boutique, stats, ventes).
-- Même logique « collection / identifiant » que Firebase, pour une migration fidèle.
CREATE TABLE IF NOT EXISTS docs (
  col        TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT    NOT NULL,          -- JSON
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (col, id)
);

-- Sessions admin (on ne stocke que l'empreinte SHA-256 du jeton, jamais le jeton).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Codes de connexion envoyés par email (empreinte salée uniquement).
CREATE TABLE IF NOT EXISTS login_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash  TEXT    NOT NULL,
  salt       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0
);

-- Limiteur de requêtes (anti-abus).
CREATE TABLE IF NOT EXISTS rl (
  k   TEXT    PRIMARY KEY,
  n   INTEGER NOT NULL,
  exp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rl_exp ON rl(exp);
