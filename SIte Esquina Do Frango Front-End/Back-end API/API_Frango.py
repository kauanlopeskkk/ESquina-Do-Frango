from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv
from redis import Redis
from sqlalchemy import Column, Integer, String, Float, DateTime, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

import os
import secrets

load_dotenv()

ADMIN_USUARIO = os.getenv("ADMIN_USUARIO", "admin")
ADMIN_SENHA = os.getenv("ADMIN_SENHA", "trocar-essa-senha")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./Mercado.db")

engine = create_async_engine(DATABASE_URL, echo=True)
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

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
    data_criacao = Column(DateTime, nullable=False)
    validade_do_produto = Column(Integer, nullable=False, default=1)

class ProdutoBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    categoria: str = "Mercearia"
    preco_de_unidade: float
    preco_do_kilo: Optional[float] = None
    data_criacao: datetime
    validade_do_produto: int = 1

    model_config = ConfigDict(from_attributes=True)

class ProdutoCreate(ProdutoBase):
    pass

class ProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    preco_de_unidade: Optional[float] = None
    preco_do_kilo: Optional[float] = None
    data_criacao: Optional[datetime] = None
    validade_do_produto: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class ProdutoResponse(ProdutoBase):
    id: int

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

@app.get("/pedidos/{pedido_id}/status")
async def verificar_status_pedido(pedido_id: str):
    return {"pedido_id": pedido_id, "status": "pendente"}

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