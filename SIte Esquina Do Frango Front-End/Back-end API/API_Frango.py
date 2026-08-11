from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv
from redis import Redis
from sqlalchemy import Column, Integer, String, Float, DateTime, select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
import mercadopago
import json
import os
import secrets

load_dotenv()

ADMIN_USUARIO = os.getenv("ADMIN_USUARIO", "admin")
ADMIN_SENHA = os.getenv("ADMIN_SENHA", "trocar-essa-senha")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./Mercado.db")

# Credenciais do Mercado Pago (crie uma conta gratuita em
# mercadopago.com.br/developers e cole as chaves de teste/produção no .env).
MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "")
MP_PUBLIC_KEY = os.getenv("MP_PUBLIC_KEY", "")

engine = create_async_engine(DATABASE_URL, echo=True)
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

sdk = mercadopago.SDK(MP_ACCESS_TOKEN) if MP_ACCESS_TOKEN else None

app = FastAPI(
    title="API do Esquina do Frango",
    description="API para gerenciar o sistema do Esquina do Frango",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
security = HTTPBasic()

# Categorias fixas do mercadinho (sem bebidas alcoólicas).
CATEGORIAS_VALIDAS = [
    "Frango e Carnes",
    "Frios e Laticínios",
    "Mercearia",
    "Higiene e Limpeza",
]


class Produtos(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    descricao = Column(String, nullable=True)
    categoria = Column(String, nullable=False, default="Mercearia")
    preco_de_unidade = Column(Float, nullable=False)
    preco_do_kilo = Column(Float, nullable=True)
    imagem_url = Column(String, nullable=True)
    data_criacao = Column(DateTime, nullable=False)
    validade_do_produto = Column(Integer, nullable=False, default=1)

class ProdutoBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    categoria: str = "Mercearia"
    preco_de_unidade: float
    preco_do_kilo: Optional[float] = None
    imagem_url: Optional[str] = None
    data_criacao: datetime
    validade_do_produto: int = 1

    model_config = ConfigDict(from_attributes=True)

class ProdutoCreate(ProdutoBase):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "nome": "Frango Inteiro Resfriado",
                "descricao": "Frango inteiro resfriado, aproximadamente 1.5kg",
                "categoria": "Frango e Carnes",
                "preco_de_unidade": 18.90,
                "preco_do_kilo": 12.50,
                "imagem_url": "https://exemplo.com/imagens/frango-inteiro.jpg",
                "data_criacao": "2026-08-09T10:00:00",
                "validade_do_produto": 5,
            }
        },
    )

class ProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    preco_de_unidade: Optional[float] = None
    preco_do_kilo: Optional[float] = None
    imagem_url: Optional[str] = None
    data_criacao: Optional[datetime] = None
    validade_do_produto: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class ProdutoResponse(ProdutoBase):
    id: int


FORMAS_PAGAMENTO_VALIDAS = ["pix", "cartao", "dinheiro"]


class Pedido(Base):
    __tablename__ = "pedidos"
    id = Column(Integer, primary_key=True, index=True)
    cliente_nome = Column(String, nullable=False)
    cliente_telefone = Column(String, nullable=False)
    cliente_email = Column(String, nullable=False)
    endereco_entrega = Column(String, nullable=False)
    itens = Column(String, nullable=False)  # lista de itens serializada em JSON
    total = Column(Float, nullable=False)
    forma_pagamento = Column(String, nullable=False)  # pix | cartao | dinheiro
    status = Column(String, nullable=False, default="pendente")
    pagamento_id_externo = Column(String, nullable=True)
    data_criacao = Column(DateTime, nullable=False)


class ItemPedido(BaseModel):
    produto_id: int
    nome: str
    quantidade: int
    preco_unitario: float


class PedidoCreate(BaseModel):
    cliente_nome: str
    cliente_telefone: str
    cliente_email: str
    endereco_entrega: str
    forma_pagamento: str
    itens: List[ItemPedido]


class PedidoResponse(BaseModel):
    id: int
    cliente_nome: str
    total: float
    forma_pagamento: str
    status: str
    data_criacao: datetime

    model_config = ConfigDict(from_attributes=True)


class PagamentoCartaoRequest(BaseModel):
    token: str
    payment_method_id: str
    installments: int = 1
    issuer_id: Optional[str] = None

async def sessao_db():
    async with SessionLocal() as db:
        yield db

def verificar_autenticacao(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USUARIO)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_SENHA)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=401,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Basic"},
        )

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        colunas = await conn.run_sync(
            lambda sync_conn: [
                col["name"] for col in sync_conn.dialect.get_columns(sync_conn, "produtos")
            ]
        )
        if "imagem_url" not in colunas:
            await conn.execute(text("ALTER TABLE produtos ADD COLUMN imagem_url VARCHAR"))

@app.get("/ola")
async def root():
    return {"message": "Bem-vindo à API do Esquina do Frango!"}

@app.get("/config/mercado-pago")
async def config_mercado_pago():
    return {"public_key": MP_PUBLIC_KEY, "habilitado": bool(sdk)}

@app.get("/categorias", response_model=List[str])
async def listar_categorias():
    return CATEGORIAS_VALIDAS

@app.get("/produtos", response_model=List[ProdutoResponse])
async def listar_produtos(categoria: Optional[str] = None, db: AsyncSession = Depends(sessao_db)):
    consulta = select(Produtos)
    if categoria:
        consulta = consulta.where(Produtos.categoria == categoria)
    resultado = await db.execute(consulta)
    return resultado.scalars().all()

@app.get("/produtos/{produto_id}", response_model=ProdutoResponse)
async def obter_produto(produto_id: int, db: AsyncSession = Depends(sessao_db)):
    produto = await db.get(Produtos, produto_id)
    if produto is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return produto

@app.post("/pedidos", response_model=PedidoResponse, status_code=201)
async def criar_pedido(pedido: PedidoCreate, db: AsyncSession = Depends(sessao_db)):
    if pedido.forma_pagamento not in FORMAS_PAGAMENTO_VALIDAS:
        raise HTTPException(
            status_code=422,
            detail=f"Forma de pagamento inválida. Use uma de: {', '.join(FORMAS_PAGAMENTO_VALIDAS)}",
        )
    if not pedido.itens:
        raise HTTPException(status_code=422, detail="O pedido precisa ter ao menos um item")

    total = round(sum(item.quantidade * item.preco_unitario for item in pedido.itens), 2)
    status_inicial = "pendente" if pedido.forma_pagamento == "dinheiro" else "aguardando_pagamento"

    novo_pedido = Pedido(
        cliente_nome=pedido.cliente_nome,
        cliente_telefone=pedido.cliente_telefone,
        cliente_email=pedido.cliente_email,
        endereco_entrega=pedido.endereco_entrega,
        itens=json.dumps([item.model_dump() for item in pedido.itens]),
        total=total,
        forma_pagamento=pedido.forma_pagamento,
        status=status_inicial,
        data_criacao=datetime.utcnow(),
    )
    db.add(novo_pedido)
    await db.commit()
    await db.refresh(novo_pedido)
    return novo_pedido

@app.post("/pagamentos/{pedido_id}/pix")
async def criar_pagamento_pix(pedido_id: int, db: AsyncSession = Depends(sessao_db)):
    if sdk is None:
        raise HTTPException(
            status_code=503,
            detail="Pagamento via Pix ainda não configurado. Defina MP_ACCESS_TOKEN no .env do backend.",
        )
    pedido = await db.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    resultado = sdk.payment().create({
        "transaction_amount": pedido.total,
        "payment_method_id": "pix",
        "description": f"Pedido #{pedido.id} - Eskina do Frango",
        "payer": {"email": pedido.cliente_email, "first_name": pedido.cliente_nome},
    })
    resposta = resultado.get("response", {})
    if resultado.get("status") not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao gerar Pix: {resposta.get('message', 'erro desconhecido')}",
        )

    dados_transacao = resposta["point_of_interaction"]["transaction_data"]
    pedido.pagamento_id_externo = str(resposta["id"])
    await db.commit()

    return {
        "pagamento_id": resposta["id"],
        "qr_code_base64": dados_transacao["qr_code_base64"],
        "qr_code": dados_transacao["qr_code"],
        "status": resposta["status"],
    }

@app.post("/pagamentos/{pedido_id}/cartao")
async def criar_pagamento_cartao(
    pedido_id: int, dados: PagamentoCartaoRequest, db: AsyncSession = Depends(sessao_db)
):
    if sdk is None:
        raise HTTPException(
            status_code=503,
            detail="Pagamento via cartão ainda não configurado. Defina MP_ACCESS_TOKEN no .env do backend.",
        )
    pedido = await db.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    resultado = sdk.payment().create({
        "transaction_amount": pedido.total,
        "token": dados.token,
        "description": f"Pedido #{pedido.id} - Eskina do Frango",
        "installments": dados.installments,
        "payment_method_id": dados.payment_method_id,
        "issuer_id": dados.issuer_id,
        "payer": {"email": pedido.cliente_email},
    })
    resposta = resultado.get("response", {})
    if resultado.get("status") not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao processar cartão: {resposta.get('message', 'erro desconhecido')}",
        )

    pedido.pagamento_id_externo = str(resposta["id"])
    pedido.status = "pago" if resposta["status"] == "approved" else resposta["status"]
    await db.commit()

    return {
        "pagamento_id": resposta["id"],
        "status": resposta["status"],
        "status_detail": resposta.get("status_detail"),
    }

@app.get("/pedidos/{pedido_id}/status")
async def verificar_status_pedido(pedido_id: int, db: AsyncSession = Depends(sessao_db)):
    pedido = await db.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    if (
        pedido.forma_pagamento in ("pix", "cartao")
        and pedido.pagamento_id_externo
        and sdk is not None
        and pedido.status != "pago"
    ):
        resultado = sdk.payment().get(pedido.pagamento_id_externo)
        resposta = resultado.get("response", {})
        if resposta.get("status") == "approved":
            pedido.status = "pago"
            await db.commit()

    return {"pedido_id": pedido.id, "status": pedido.status}

@app.post("/produtos", response_model=ProdutoResponse, status_code=201)
async def criar_produto(
    produto: ProdutoCreate,
    db: AsyncSession = Depends(sessao_db),
    _: None = Depends(verificar_autenticacao),
):
    if produto.categoria not in CATEGORIAS_VALIDAS:
        raise HTTPException(
            status_code=422,
            detail=f"Categoria inválida. Use uma de: {', '.join(CATEGORIAS_VALIDAS)}",
        )
    novo_produto = Produtos(**produto.model_dump())
    db.add(novo_produto)
    await db.commit()
    await db.refresh(novo_produto)
    return novo_produto

@app.put("/produtos/{produto_id}", response_model=ProdutoResponse)
async def atualizar_produto(
    produto_id: int,
    produto: ProdutoUpdate,
    db: AsyncSession = Depends(sessao_db),
    _: None = Depends(verificar_autenticacao),
):
    produto_existente = await db.get(Produtos, produto_id)
    if produto_existente is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    dados = produto.model_dump(exclude_unset=True)
    if "categoria" in dados and dados["categoria"] not in CATEGORIAS_VALIDAS:
        raise HTTPException(
            status_code=422,
            detail=f"Categoria inválida. Use uma de: {', '.join(CATEGORIAS_VALIDAS)}",
        )
    for campo, valor in dados.items():
        setattr(produto_existente, campo, valor)
    await db.commit()
    await db.refresh(produto_existente)
    return produto_existente

@app.delete("/produtos/{produto_id}", status_code=204)
async def deletar_produto(
    produto_id: int,
    db: AsyncSession = Depends(sessao_db),
    _: None = Depends(verificar_autenticacao),
):
    produto_existente = await db.get(Produtos, produto_id)
    if produto_existente is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    await db.delete(produto_existente)
    await db.commit()