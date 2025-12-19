from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

from verifier import BookVerifier
from summarizer import BookSummarizer
from config_manager import ConfigManager

load_dotenv()

app = FastAPI(title="Pustaka+ API")
config_manager = ConfigManager()

# Ensure covers directory exists for static mounting
COVERS_DIR = os.path.join(os.path.dirname(__file__), 'covers')
os.makedirs(COVERS_DIR, exist_ok=True)

# Mount covers directory to serve images
app.mount("/covers", StaticFiles(directory=COVERS_DIR), name="covers")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VerificationRequest(BaseModel):
    isbn: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None


class ConfigRequest(BaseModel):
    openrouter_key: Optional[str] = None
    openrouter_model: Optional[str] = None
    ollama_model: Optional[str] = None
    groq_key: Optional[str] = None
    groq_model: Optional[str] = None
    provider: Optional[str] = None

class CoverUpdateRequest(BaseModel):
    image_url: str

class MetadataUpdateRequest(BaseModel):
    title: str
    author: str
    isbn: str

@app.get("/")
def read_root():
    return {"message": "Pustaka+ Backend is Running"}

@app.get("/api/config")
def get_config():
    return config_manager.load_config()

@app.get("/api/covers/search")
def search_covers(query: str):
    return BookVerifier().search_book_covers(query)

@app.post("/api/config")
def update_config(req: ConfigRequest):
    current_config = config_manager.load_config()
    
    if req.openrouter_key is not None:
        current_config["openrouter_key"] = req.openrouter_key
    if req.openrouter_model is not None:
        current_config["openrouter_model"] = req.openrouter_model
    if req.ollama_base_url is not None:
        current_config["ollama_base_url"] = req.ollama_base_url
    if req.ollama_model is not None:
        current_config["ollama_model"] = req.ollama_model
    if req.groq_key is not None:
        current_config["groq_key"] = req.groq_key
    if req.groq_model is not None:
        current_config["groq_model"] = req.groq_model
    if req.provider is not None:
        current_config["provider"] = req.provider
        
    config_manager.save_config(current_config)
    return {"status": "success", "config": current_config}


@app.post("/api/verify")
def verify_book(req: VerificationRequest):
    verifier = BookVerifier()
    is_valid, sources, message, status = verifier.validate_book(req.isbn, req.title, req.author)
    return {
        "is_valid": is_valid,
        "sources": sources,
        "message": message,
        "status": status
    }


class SummarizationRequest(BaseModel):
    metadata: List[Dict]
    api_key: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = "OpenRouter"
    base_url: Optional[str] = None
    partial_content: Optional[str] = None


@app.post("/api/summarize")
def summarize_book(req: SummarizationRequest):
    # Determine API Key & Provider from request or config
    config = config_manager.load_config()
    
    provider = req.provider or config.get("provider", "OpenRouter")
    api_key = req.api_key or (config.get("openrouter_key") if provider == "OpenRouter" else config.get("groq_key"))
    model = req.model or (config.get("openrouter_model") if provider == "OpenRouter" else config.get("groq_model"))
    base_url = req.base_url or config.get("ollama_base_url")

    # If Ollama, model might be different
    if provider == "Ollama":
        model = req.model or config.get("ollama_model", "llama3")

    summarizer = BookSummarizer(
        api_key=api_key, 
        model_name=model, 
        provider=provider, 
        base_url=base_url
    )
    
    return StreamingResponse(
        summarizer.summarize_stream(req.metadata, partial_content=req.partial_content),
        media_type="text/event-stream"
    )


@app.post("/api/models")
def list_models(req: Dict):
    provider = req.get("provider", "OpenRouter")
    api_key = req.get("api_key")
    base_url = req.get("base_url")

    if provider == "OpenRouter":
        if not api_key:
             raise HTTPException(status_code=400, detail="OpenRouter API Key is required")
        try:
            from openai import OpenAI
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
                default_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "Pustaka+",
                }
            )
            models = client.models.list()
            model_ids = [m.id for m in models.data]
            model_ids.sort()
            return {"valid": True, "models": model_ids}
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"OpenRouter Error: {str(e)}")
    
    elif provider == "Groq":
        if not api_key:
             raise HTTPException(status_code=400, detail="Groq API Key is required")
        try:
            from openai import OpenAI
            client = OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=api_key
            )
            models = client.models.list()
            model_ids = [m.id for m in models.data]
            model_ids.sort()
            return {"valid": True, "models": model_ids}
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Groq Error: {str(e)}")
    
    elif provider == "Ollama":
        import requests
        url = f"{base_url or 'http://localhost:11434'}/api/tags"
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return {"valid": True, "models": models}
            else:
                raise HTTPException(status_code=response.status_code, detail=f"Ollama Error: {response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to connect to Ollama: {str(e)}")
    
    return {"valid": False, "models": []}


# --- Saved Summaries Endpoints ---
from storage_manager import StorageManager

storage_manager = StorageManager()

class SaveSummaryRequest(BaseModel):
    title: str
    author: str
    summary_content: str
    usage_stats: Dict
    metadata: Optional[Dict] = {}

@app.get("/api/saved")
def get_saved_summaries():
    return storage_manager.get_all_summaries()

@app.post("/api/save")
def save_summary(req: SaveSummaryRequest):
    return storage_manager.save_summary({
        "title": req.title,
        "author": req.author,
        "summary_content": req.summary_content,
        "usage_stats": req.usage_stats,
        "metadata": req.metadata
    })

@app.delete("/api/saved/{summary_id}")
def delete_summary(summary_id: str):
    success = storage_manager.delete_summary(summary_id)
    if not success:
        raise HTTPException(status_code=404, detail="Summary not found")
    return {"status": "success", "id": summary_id}

@app.put("/api/books/{book_id}/cover")
def update_book_cover(book_id: str, request: CoverUpdateRequest):
    updated_book = storage_manager.update_book_cover(book_id, request.image_url)
    if not updated_book:
        raise HTTPException(status_code=404, detail="Book not found")
    return updated_book

@app.put("/api/books/{book_id}/metadata")
def update_book_metadata(book_id: str, request: MetadataUpdateRequest):
    updated_book = storage_manager.update_book_metadata(book_id, request.title, request.author, request.isbn)
    if not updated_book:
        raise HTTPException(status_code=404, detail="Book not found")
    return updated_book

@app.delete("/api/books/{book_id}")
def delete_book(book_id: str):
    success = storage_manager.delete_book(book_id)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"status": "success", "id": book_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
