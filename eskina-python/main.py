import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from database import get_db, semear

PASTA = Path(__file__).resolve().parent
SENHA = os.environ.get("ADMIN_SENHA", "trocar-essa-senha")
PORTA = int(os.environ.get("PORTA", "3000"))

semear()

app = FastAPI()

# ---------------------------------------------------------------------
# Sessão do dono
# ---------------------------------------------------------------------

sessoes: dict[str, float] = {}  # token -> validade (epoch seconds)
DURACAO = 60 * 60 * 8  # 8 horas


def compara_senha(enviada: str) -> bool:
    a = enviada.encode()
    b = SENHA.encode()
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)


def exige_dono(authorization: Optional[str] = Header(default=None)) -> None:
    token = (authorization or "").replace("Bearer ", "")
    validade = sessoes.get(token)
    if not validade or validade < time.time():
        sessoes.pop(token, None)
        raise HTTPException(status_code=401, detail="Faça login na área do dono para continuar.")


# ---------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------


class LoginBody(BaseModel):
    senha: str = ""


class ProdutoBody(BaseModel):
    nome: str = ""
    categoria: str = "Mercearia"
    preco: float | str | None = None
    unidade: str = "un"
    icone: str = "🛒"
    destaque: bool = False
    ativo: bool = True


class ConfigBody(BaseModel):
    zap: Optional[str] = None
    pix: Optional[str] = None
    endereco: Optional[str] = None
    horario: Optional[str] = None
    taxa: Optional[str] = None


class ItemPedido(BaseModel):
    id: int
    qtd: float = 1


class PedidoBody(BaseModel):
    cliente: Optional[str] = ""
    itens: list[ItemPedido] = []
    pagamento: Optional[str] = "PIX"
    entrega: Optional[str] = "retirar"
    endereco: Optional[str] = ""
    troco: Optional[float] = None


class StatusBody(BaseModel):
    status: str


# ---------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------


@app.post("/api/login")
def login(body: LoginBody):
    if not compara_senha(body.senha):
        raise HTTPException(status_code=401, detail="Senha incorreta.")
    token = secrets.token_hex(24)
    sessoes[token] = time.time() + DURACAO
    return {"token": token, "expiraEm": DURACAO * 1000}


@app.post("/api/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    exige_dono(authorization)
    token = (authorization or "").replace("Bearer ", "")
    sessoes.pop(token, None)
    return {"ok": True}


# ---------------------------------------------------------------------
# Produtos
# ---------------------------------------------------------------------


def para_produto(row: dict) -> dict:
    p = dict(row)
    p["destaque"] = bool(p["destaque"])
    p["ativo"] = bool(p["ativo"])
    return p


def valida_produto(c: ProdutoBody) -> dict:
    nome = (c.nome or "").strip()
    try:
        preco = float(c.preco) if c.preco is not None else float("nan")
    except (TypeError, ValueError):
        preco = float("nan")

    if not nome:
        raise HTTPException(status_code=400, detail="Escreva o nome do produto.")
    if len(nome) > 80:
        raise HTTPException(status_code=400, detail="O nome pode ter no máximo 80 letras.")
    if preco != preco or preco <= 0:  # NaN check
        raise HTTPException(status_code=400, detail="Escreva um preço maior que zero.")

    return {
        "nome": nome,
        "preco": round(preco * 100) / 100,
        "categoria": (c.categoria or "Mercearia").strip() or "Mercearia",
        "unidade": (c.unidade or "un").strip() or "un",
        "icone": (c.icone or "🛒").strip()[:4] or "🛒",
        "destaque": 1 if c.destaque else 0,
        "ativo": 0 if c.ativo is False else 1,
    }


@app.get("/api/produtos")
def listar_produtos(todos: str = Query(default="")):
    db = get_db()
    filtro = "" if todos == "1" else "WHERE ativo = 1"
    linhas = db.execute(
        f"SELECT * FROM produtos {filtro} ORDER BY destaque DESC, categoria, nome"
    ).fetchall()
    return [para_produto(r) for r in linhas]


@app.post("/api/produtos", status_code=201)
def criar_produto(body: ProdutoBody, authorization: Optional[str] = Header(default=None)):
    exige_dono(authorization)
    dados = valida_produto(body)
    db = get_db()
    cur = db.execute(
        """INSERT INTO produtos (nome, categoria, preco, unidade, icone, destaque, ativo)
           VALUES (:nome, :categoria, :preco, :unidade, :icone, :destaque, :ativo)""",
        dados,
    )
    db.commit()
    novo = db.execute("SELECT * FROM produtos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return para_produto(novo)


@app.put("/api/produtos/{produto_id}")
def editar_produto(produto_id: int, body: ProdutoBody, authorization: Optional[str] = Header(default=None)):
    exige_dono(authorization)
    db = get_db()
    existe = db.execute("SELECT id FROM produtos WHERE id = ?", (produto_id,)).fetchone()
    if not existe:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    dados = valida_produto(body)
    dados["id"] = produto_id
    db.execute(
        """UPDATE produtos SET nome=:nome, categoria=:categoria, preco=:preco,
           unidade=:unidade, icone=:icone, destaque=:destaque, ativo=:ativo WHERE id=:id""",
        dados,
    )
    db.commit()
    return para_produto(db.execute("SELECT * FROM produtos WHERE id = ?", (produto_id,)).fetchone())


@app.delete("/api/produtos/{produto_id}")
def apagar_produto(produto_id: int, authorization: Optional[str] = Header(default=None)):
    exige_dono(authorization)
    db = get_db()
    cur = db.execute("DELETE FROM produtos WHERE id = ?", (produto_id,))
    db.commit()
    if not cur.rowcount:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return {"ok": True}


# ---------------------------------------------------------------------
# Configuração da loja
# ---------------------------------------------------------------------

CAMPOS_CONFIG = ["zap", "pix", "endereco", "horario", "taxa"]


@app.get("/api/config")
def obter_config():
    db = get_db()
    linhas = db.execute("SELECT chave, valor FROM config").fetchall()
    return {l["chave"]: l["valor"] for l in linhas}


@app.put("/api/config")
def salvar_config(body: ConfigBody, authorization: Optional[str] = Header(default=None)):
    exige_dono(authorization)
    db = get_db()
    valores = body.model_dump()
    for campo in CAMPOS_CONFIG:
        if valores.get(campo) is not None:
            db.execute(
                """INSERT INTO config (chave, valor) VALUES (?, ?)
                   ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor""",
                (campo, str(valores[campo])[:200]),
            )
    db.commit()
    linhas = db.execute("SELECT chave, valor FROM config").fetchall()
    return {l["chave"]: l["valor"] for l in linhas}


# ---------------------------------------------------------------------
# Pedidos
# ---------------------------------------------------------------------


@app.post("/api/pedidos", status_code=201)
def criar_pedido(body: PedidoBody):
    if not body.itens:
        raise HTTPException(status_code=400, detail="O pedido está sem itens.")
    if body.entrega == "entrega" and not (body.endereco or "").strip():
        raise HTTPException(status_code=400, detail="Escreva o endereço da entrega.")

    db = get_db()
    detalhados = []
    subtotal = 0.0

    for item in body.itens:
        p = db.execute(
            "SELECT id, nome, preco, unidade FROM produtos WHERE id = ? AND ativo = 1",
            (item.id,),
        ).fetchone()
        if not p:
            raise HTTPException(
                status_code=400, detail="Um produto do carrinho saiu da loja. Atualize a página."
            )
        qtd = max(1, min(99, round(item.qtd or 1)))
        subtotal += p["preco"] * qtd
        detalhados.append({"id": p["id"], "nome": p["nome"], "preco": p["preco"], "unidade": p["unidade"], "qtd": qtd})

    linha_taxa = db.execute("SELECT valor FROM config WHERE chave = 'taxa'").fetchone()
    try:
        taxa_loja = float(linha_taxa["valor"]) if linha_taxa else 0.0
    except (TypeError, ValueError):
        taxa_loja = 0.0
    taxa = taxa_loja if body.entrega == "entrega" else 0.0
    total = round((subtotal + taxa) * 100) / 100

    cur = db.execute(
        """INSERT INTO pedidos (cliente, itens, subtotal, taxa, total, pagamento, entrega, endereco, troco)
           VALUES (:cliente, :itens, :subtotal, :taxa, :total, :pagamento, :entrega, :endereco, :troco)""",
        {
            "cliente": (body.cliente or "").strip()[:80] or None,
            "itens": json.dumps(detalhados, ensure_ascii=False),
            "subtotal": round(subtotal * 100) / 100,
            "taxa": taxa,
            "total": total,
            "pagamento": (body.pagamento or "PIX")[:40],
            "entrega": "entrega" if body.entrega == "entrega" else "retirar",
            "endereco": (body.endereco or "").strip()[:200] or None,
            "troco": body.troco,
        },
    )
    db.commit()
    return {"id": cur.lastrowid, "itens": detalhados, "subtotal": subtotal, "taxa": taxa, "total": total}


@app.get("/api/pedidos")
def listar_pedidos(authorization: Optional[str] = Header(default=None)):
    exige_dono(authorization)
    db = get_db()
    linhas = db.execute("SELECT * FROM pedidos ORDER BY id DESC LIMIT 100").fetchall()
    resultado = []
    for p in linhas:
        d = dict(p)
        d["itens"] = json.loads(d["itens"])
        resultado.append(d)
    return resultado


@app.patch("/api/pedidos/{pedido_id}")
def mudar_status(pedido_id: int, body: StatusBody, authorization: Optional[str] = Header(default=None)):
    exige_dono(authorization)
    if body.status not in ("novo", "separando", "entregue", "cancelado"):
        raise HTTPException(status_code=400, detail="Status inválido.")
    db = get_db()
    cur = db.execute("UPDATE pedidos SET status = ? WHERE id = ?", (body.status, pedido_id))
    db.commit()
    if not cur.rowcount:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    return {"ok": True}


# ---------------------------------------------------------------------
# Erros e estáticos
# ---------------------------------------------------------------------


@app.api_route("/api/{caminho:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_nao_encontrada(caminho: str):
    raise HTTPException(status_code=404, detail="Endereço não existe nesta API.")


@app.exception_handler(HTTPException)
def erro_http(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"erro": exc.detail})


@app.exception_handler(Exception)
def erro_geral(request: Request, exc: Exception):
    print(exc)
    return JSONResponse(status_code=500, content={"erro": "Deu problema no servidor. Tente de novo."})


app.mount("/", StaticFiles(directory=str(PASTA / "public"), html=True), name="public")


if __name__ == "__main__":
    import uvicorn

    if SENHA == "trocar-essa-senha":
        print("  ATENÇÃO: defina ADMIN_SENHA antes de colocar o site na internet.\n")
    print(f"\n  Eskina do Frango no ar em http://localhost:{PORTA}")
    uvicorn.run(app, host="0.0.0.0", port=PORTA)
