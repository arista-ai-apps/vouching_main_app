from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine
from .models import models
from .api import clients, engagements, files, reconciliation, exceptions, registers, bill_of_sale, hsn

from fastapi.staticfiles import StaticFiles
import os

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
app.mount("/storage", StaticFiles(directory=settings.STORAGE_DIR), name="storage")

app.include_router(clients.router, prefix=settings.API_V1_STR)
app.include_router(engagements.router, prefix=settings.API_V1_STR)
app.include_router(files.router, prefix=settings.API_V1_STR)
app.include_router(registers.router, prefix=settings.API_V1_STR)
app.include_router(reconciliation.router, prefix=settings.API_V1_STR)
app.include_router(exceptions.router, prefix=settings.API_V1_STR)
app.include_router(bill_of_sale.router, prefix=settings.API_V1_STR)
app.include_router(hsn.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Arista AI SV-CIE API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
