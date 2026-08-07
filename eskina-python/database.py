import os
import sqlite3
from pathlib import Path

CAMINHO = os.environ.get("BANCO", "./dados/loja.db")
Path(CAMINHO).parent.mkdir(parents=True, exist_ok=True)

_conexao = sqlite3.connect(CAMINHO, check_same_thread=False)
_conexao.row_factory = sqlite3.Row
_conexao.execute("PRAGMA journal_mode = WAL")
_conexao.execute("PRAGMA foreign_keys = ON")


def get_db() -> sqlite3.Connection:
    return _conexao


ESQUEMA = """
CREATE TABLE IF NOT EXISTS produtos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  categoria TEXT    NOT NULL DEFAULT 'Mercearia',
  preco     REAL    NOT NULL,
  unidade   TEXT    NOT NULL DEFAULT 'un',
  icone     TEXT    NOT NULL DEFAULT '🛒',
  destaque  INTEGER NOT NULL DEFAULT 0,
  ativo     INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pedidos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente   TEXT,
  itens     TEXT    NOT NULL,
  subtotal  REAL    NOT NULL,
  taxa      REAL    NOT NULL DEFAULT 0,
  total     REAL    NOT NULL,
  pagamento TEXT    NOT NULL,
  entrega   TEXT    NOT NULL,
  endereco  TEXT,
  troco     REAL,
  status    TEXT    NOT NULL DEFAULT 'novo',
  criado_em TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
"""

CONFIG_PADRAO = {
    "zap": "",
    "pix": "",
    "endereco": "",
    "horario": "Segunda a sábado, das 7h às 20h",
    "taxa": "5",
}

PRODUTOS_INICIAIS = [
    ("Frango inteiro congelado", "Frango", 12.90, "kg", "🐔", 1),
    ("Coxa e sobrecoxa", "Frango", 11.90, "kg", "🍗", 1),
    ("Filé de peito", "Frango", 22.90, "kg", "🍗", 0),
    ("Asa de frango", "Frango", 14.90, "kg", "🍗", 0),
    ("Coração de frango", "Frango", 24.90, "kg", "🍢", 0),
    ("Linguiça toscana", "Frios e queijos", 26.90, "kg", "🌭", 0),
    ("Queijo mussarela fatiado", "Frios e queijos", 42.90, "kg", "🧀", 1),
    ("Presunto cozido fatiado", "Frios e queijos", 29.90, "kg", "🥓", 0),
    ("Mortadela fatiada", "Frios e queijos", 19.90, "kg", "🥪", 0),
    ("Queijo coalho", "Frios e queijos", 39.90, "kg", "🧀", 0),
    ("Ovos brancos", "Mercearia", 12.90, "dz", "🥚", 0),
    ("Arroz branco 5kg", "Mercearia", 27.90, "pct", "🍚", 0),
    ("Feijão carioca 1kg", "Mercearia", 8.90, "pct", "🫘", 0),
    ("Carvão vegetal 3kg", "Mercearia", 24.90, "pct", "🔥", 0),
    ("Refrigerante 2L", "Bebidas", 9.90, "un", "🥤", 0),
    ("Cerveja lata gelada", "Bebidas", 4.50, "un", "🍺", 0),
]


def semear() -> None:
    db = get_db()
    db.executescript(ESQUEMA)

    tem_config = db.execute("SELECT COUNT(*) c FROM config").fetchone()["c"]
    if not tem_config:
        db.executemany(
            "INSERT INTO config (chave, valor) VALUES (?, ?)",
            list(CONFIG_PADRAO.items()),
        )
        db.commit()

    tem_produto = db.execute("SELECT COUNT(*) c FROM produtos").fetchone()["c"]
    if not tem_produto:
        db.executemany(
            "INSERT INTO produtos (nome, categoria, preco, unidade, icone, destaque) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            PRODUTOS_INICIAIS,
        )
        db.commit()
        print(f"Banco criado com {len(PRODUTOS_INICIAIS)} produtos de exemplo.")
