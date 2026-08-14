from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import close_pool
from routers.analytics import router as analytics_router
from routers.mapa import router as mapa_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(title="pladi API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mapa_router)
app.include_router(analytics_router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "pladi-api"}
