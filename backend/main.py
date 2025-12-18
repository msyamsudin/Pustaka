from fastapi import FastAPI, HTTPException
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


class SummarizationRequest(BaseModel):
    metadata: List[Dict]
    api_key: Optional[str] = None
    model: Optional[str] = None  # For OpenRouter specific model


class ConfigRequest(BaseModel):
    openrouter_key: Optional[str] = None
    openrouter_model: Optional[str] = None

class CoverUpdateRequest(BaseModel):
    image_url: str

class MetadataUpdateRequest(BaseModel):
    title: str
    author: str
    isbn: str

@app.get("/")
def read_root():
    return {"message": "Perpustakaan AI Backend is Running"}


@app.get("/api/config")
def get_config():
    return config_manager.load_config()

@app.get("/api/covers/search")
def search_covers(query: str):
    return BookVerifier().search_book_covers(query)

@app.put("/api/books/{book_id}/cover")
def update_book_cover(book_id: str, request: CoverUpdateRequest):
    # Determine storage manager instance (assuming it needs to be instantiated or singleton)
    # Since storage_manager.py has StorageManager class but not instantiated globally here yet
    # We'll instantiate it inside (or better, instantiate globally like config_manager)
    from storage_manager import StorageManager
    storage = StorageManager()
    new_path = storage.update_book_cover(book_id, request.image_url)
    if new_path:
        return {"success": True, "image_url": new_path}
    raise HTTPException(status_code=404, detail="Book not found")


@app.post("/api/config")
def update_config(req: ConfigRequest):
    current_config = config_manager.load_config()
    
    if req.openrouter_key is not None:
        current_config["openrouter_key"] = req.openrouter_key
        
    if req.openrouter_model is not None:
        current_config["openrouter_model"] = req.openrouter_model
        
    config_manager.save_config(current_config)
    return {"status": "success", "config": current_config}


@app.post("/api/verify")
def verify_book(req: VerificationRequest):
    verifier = BookVerifier()
    is_valid, sources, message = verifier.validate_book(req.isbn, req.title, req.author)
    return {
        "is_valid": is_valid,
        "sources": sources,
        "message": message
    }


@app.post("/api/summarize")
def summarize_book(req: SummarizationRequest):
    # Determine API Key
    api_key = req.api_key
    if not api_key:
        api_key = config_manager.get_key("openrouter_key")
    
    # Determine Model
    model = req.model
    if not model:
        model = config_manager.get_key("openrouter_model")

    if not api_key:
        raise HTTPException(status_code=400, detail="OpenRouter API Key is required")
    
    summarizer = BookSummarizer(api_key, model_name=model)
    result = summarizer.summarize(req.metadata)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return {
        "summary": result["content"],
        "usage": result["usage"],
        "model": result["model"],
        "provider": result["provider"],
        "cost_estimate": result.get("cost_estimate"),
        "duration_seconds": result.get("duration_seconds")
    }


class ModelsRequest(BaseModel):
    api_key: str


@app.post("/api/models")
def list_models(req: ModelsRequest):
    print(f"Validating OpenRouter Key: {req.api_key[:5]}...")
    try:
        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=req.api_key,
            default_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "Perpustakaan AI",
            }
        )
        # Fetch models to validate key
        models = client.models.list()
        print("OpenRouter Validation Success")
        # Sort and filter interesting ones, or just return top IDs
        model_ids = [m.id for m in models.data]
        model_ids.sort()
        return {"valid": True, "models": model_ids}
    except Exception as e:
        print(f"OpenRouter Validation Failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"OpenRouter Error: {str(e)}")


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
