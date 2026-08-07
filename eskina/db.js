import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CAMINHO = process.env.BANCO || './dados/loja.db';
mkdirSync(dirname(CAMINHO), { recursive: true });

export const db = new Database(CAMINHO);
db.pragma('journal_mode = WAL');

db.exec(`
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
`);

/* ---------- dados iniciais ---------- */

const CONFIG_PADRAO = {
  zap: '',
  pix: '',
  endereco: '',
  horario: 'Segunda a sábado, das 7h às 20h',
  taxa: '5'
};

const PRODUTOS_INICIAIS = [
  ['Frango inteiro congelado', 'Frango', 12.90, 'kg', '🐔', 1],
  ['Coxa e sobrecoxa', 'Frango', 11.90, 'kg', '🍗', 1],
  ['Filé de peito', 'Frango', 22.90, 'kg', '🍗', 0],
  ['Asa de frango', 'Frango', 14.90, 'kg', '🍗', 0],
  ['Coração de frango', 'Frango', 24.90, 'kg', '🍢', 0],
  ['Linguiça toscana', 'Frios e queijos', 26.90, 'kg', '🌭', 0],
  ['Queijo mussarela fatiado', 'Frios e queijos', 42.90, 'kg', '🧀', 1],
  ['Presunto cozido fatiado', 'Frios e queijos', 29.90, 'kg', '🥓', 0],
  ['Mortadela fatiada', 'Frios e queijos', 19.90, 'kg', '🥪', 0],
  ['Queijo coalho', 'Frios e queijos', 39.90, 'kg', '🧀', 0],
  ['Ovos brancos', 'Mercearia', 12.90, 'dz', '🥚', 0],
  ['Arroz branco 5kg', 'Mercearia', 27.90, 'pct', '🍚', 0],
  ['Feijão carioca 1kg', 'Mercearia', 8.90, 'pct', '🫘', 0],
  ['Carvão vegetal 3kg', 'Mercearia', 24.90, 'pct', '🔥', 0],
  ['Refrigerante 2L', 'Bebidas', 9.90, 'un', '🥤', 0],
  ['Cerveja lata gelada', 'Bebidas', 4.50, 'un', '🍺', 0]
];

export function semear() {
  const temConfig = db.prepare('SELECT COUNT(*) c FROM config').get().c;
  if (!temConfig) {
    const ins = db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?)');
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(CONFIG_PADRAO)) ins.run(k, v);
    });
    tx();
  }

  const temProduto = db.prepare('SELECT COUNT(*) c FROM produtos').get().c;
  if (!temProduto) {
    const ins = db.prepare(
      'INSERT INTO produtos (nome, categoria, preco, unidade, icone, destaque) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      for (const p of PRODUTOS_INICIAIS) ins.run(...p);
    });
    tx();
    console.log(`Banco criado com ${PRODUTOS_INICIAIS.length} produtos de exemplo.`);
  }
}
