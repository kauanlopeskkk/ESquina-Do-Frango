from celery import Celery
import json
import os
from dotenv import load_dotenv
from redis import Redis
load_dotenv()
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

celery_app = Celery(
    "Celery_Frango",
    broker=f"redis://{REDIS_HOST}:{REDIS_PORT}/0",
    backend=f"redis://{REDIS_HOST}:{REDIS_PORT}/0",
)

@celery_app.task
def processar_pedido(pedido):
    # Aqui você pode adicionar a lógica para processar o pedido
    # Por exemplo, salvar no banco de dados, enviar notificações, etc.
    # Este é apenas um exemplo simples que retorna o pedido recebido.
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
    redis_client.set(f"pedido:{pedido['id']}", json.dumps(pedido))
    return {"status": "Pedido processado com sucesso", "pedido": pedido}


@celery_app.task
def verificar_status_pedido(pedido_id):
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
    pedido = redis_client.get(f"pedido:{pedido_id}")
    if pedido:
        return {"status": "Pedido encontrado", "pedido": json.loads(pedido.decode("utf-8"))}
    else:
        return {"status": "Pedido não encontrado", "pedido_id": pedido_id}

@celery_app.task
def atualizar_status_pedido(pedido_id, novo_status):
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
    pedido = redis_client.get(f"pedido:{pedido_id}")
    if pedido:
        pedido_dict = json.loads(pedido.decode("utf-8"))
        pedido_dict["status"] = novo_status
        redis_client.set(f"pedido:{pedido_id}", json.dumps(pedido_dict))

@celery_app.task
def deletar_pedido(pedido_id):
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
    pedido = redis_client.get(f"pedido:{pedido_id}")
    if pedido:
        redis_client.delete(f"pedido:{pedido_id}")
        return {"status": "Pedido deletado com sucesso", "pedido_id": pedido_id}
    else:
        return {"status": "Pedido não encontrado", "pedido_id": pedido_id}