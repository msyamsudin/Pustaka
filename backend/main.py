from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import os
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

from verifier import BookVerifier
from summarizer import BookSummarizer
from config_manager import ConfigManager
from storage_manager import StorageManager
from notion_manager import NotionManager

load_dotenv()

app = FastAPI(title="Pustaka+ API")
config_manager = ConfigManager()
storage_manager = StorageManager()

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
    ollama_base_url: Optional[str] = None
    provider: Optional[str] = None
    notion_api_key: Optional[str] = None
    notion_database_id: Optional[str] = None
    brave_api_key: Optional[str] = None
    enable_search_enrichment: Optional[bool] = None
    search_max_results: Optional[int] = None


class CoverUpdateRequest(BaseModel):
    image_url: str

class MetadataUpdateRequest(BaseModel):
    title: str
    author: str
    isbn: str
    genre: Optional[str] = None

class NotionShareRequest(BaseModel):
    title: str
    author: str
    summary_content: str
    metadata: Optional[Dict] = {}

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
    if req.notion_api_key is not None:
        current_config["notion_api_key"] = req.notion_api_key
    if req.notion_database_id is not None:
        current_config["notion_database_id"] = req.notion_database_id
    if req.brave_api_key is not None:
        current_config["brave_api_key"] = req.brave_api_key
    if req.enable_search_enrichment is not None:
        current_config["enable_search_enrichment"] = req.enable_search_enrichment
    if req.search_max_results is not None:
        current_config["search_max_results"] = max(1, min(req.search_max_results, 10))  # Clamp 1-10
        
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
    enhance_quality: Optional[bool] = False
    draft_count: Optional[int] = 3
    iterative_mode: Optional[bool] = False
    critic_model: Optional[str] = None
    max_iterations: Optional[int] = 3
    target_score: Optional[int] = 90
    
class SynthesisRequest(BaseModel):
    summary_ids: List[str]
    model: Optional[str] = None
    provider: Optional[str] = "OpenRouter"

class ElaborationRequest(BaseModel):
    selection: str
    query: Optional[str] = ""
    context: Optional[str] = ""
    history: Optional[List[Dict[str, str]]] = []
    api_key: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = "OpenRouter"
    base_url: Optional[str] = None

@app.post("/api/summarize")
async def summarize_book(req: SummarizationRequest):
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
        base_url=base_url,
        search_config=config  # Pass full config for search
    )
    
    if req.enhance_quality:
        return StreamingResponse(
            summarizer.summarize_tournament_stream(req.metadata, n=req.draft_count or 3),
            media_type="text/event-stream"
        )

    if req.iterative_mode:
        return StreamingResponse(
            summarizer.summarize_iterative_stream(
                req.metadata, 
                max_iterations=req.max_iterations or 3,
                target_score=req.target_score or 90,
                critic_model=req.critic_model
            ),
            media_type="text/event-stream"
        )

    return StreamingResponse(
        summarizer.summarize_stream(req.metadata, partial_content=req.partial_content),
        media_type="text/event-stream"
    )

@app.post("/api/synthesize")
async def synthesize_summaries(req: SynthesisRequest):
    data = storage_manager.get_all_summaries()
    
    # Extract draf contents based on IDs with validation
    drafts = []
    source_models = []
    book_ids = set()
    title = "Unknown"
    author = "Unknown"
    genre = ""
    year = ""
    
    for book in data:
        for s in book['summaries']:
            if s['id'] in req.summary_ids:
                # Track which book this summary belongs to
                book_ids.add(book['id'])
                
                # Validate draft content is not empty
                draft_content = s.get('summary_content', '').strip()
                if not draft_content:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Summary {s['id']} has empty content and cannot be synthesized."
                    )
                
                drafts.append(draft_content)
                source_models.append(s.get('model', 'Unknown'))
                title = book['title']
                author = book['author']
                genre = book.get('genre', '')
                year = book.get('publishedDate', '')

    # Validation 1: Check if any summaries were found
    if not drafts:
        raise HTTPException(status_code=404, detail="No matching summaries found for synthesis.")
    
    # Validation 2: Ensure all summaries come from the same book
    if len(book_ids) > 1:
        raise HTTPException(
            status_code=400, 
            detail="Cannot synthesize summaries from different books. All selected variants must be from the same book."
        )
    
    # Validation 3: Ensure we have at least 2 drafts
    if len(drafts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Synthesis requires at least 2 summary variants. Please select more variants."
        )

    # API Configuration
    config = config_manager.load_config()
    provider = req.provider or config.get("provider", "OpenRouter")
    api_key = (config.get("openrouter_key") if provider == "OpenRouter" else config.get("groq_key"))
    model = req.model or (config.get("openrouter_model") if provider == "OpenRouter" else config.get("groq_model"))
    base_url = config.get("ollama_base_url")

    summarizer = BookSummarizer(api_key=api_key, model_name=model, provider=provider, base_url=base_url, search_config=config)
    
    # Calculate diversity analysis before synthesis
    diversity_analysis = summarizer._calculate_draft_diversity(drafts)
    
    # Perform streaming synthesis
    
    async def event_generator():
        async for update in summarizer.summarize_synthesize(title, author, genre, year, drafts, diversity_analysis=diversity_analysis):
            if "error" in update:
                yield f"data: {json.dumps(update)}\n\n"
                break
            
            # Prepare data to yield
            yield_data = {**update}
            
            # If this is the final chunk with done flag, add additional metadata
            if "done" in yield_data and yield_data["done"]:
                yield_data["source_models"] = source_models
                yield_data["source_summary_ids"] = req.summary_ids
                yield_data["source_draft_count"] = len(drafts)
                yield_data["diversity_analysis"] = diversity_analysis
            
            yield f"data: {json.dumps(yield_data)}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/elaborate")
def elaborate_text(req: ElaborationRequest):
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
    
    return summarizer.elaborate(req.selection, req.query, req.context, req.history)


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


@app.post("/api/search/test")
def test_search_api(req: Dict):
    """Test Brave API key and search functionality"""
    brave_api_key = req.get("brave_api_key")
    
    if not brave_api_key:
        raise HTTPException(status_code=400, detail="Brave API key is required for testing")
    
    try:
        from search_service import BraveSearchClient
        client = BraveSearchClient(api_key=brave_api_key, timeout=5)
        
        # Test with a simple query
        result = client.search("Python programming", count=2)
        
        if "error" in result:
            if "Invalid" in result["error"] or "401" in result["error"]:
                raise HTTPException(status_code=401, detail=f"Invalid Brave API key: {result['error']}")
            else:
                raise HTTPException(status_code=500, detail=f"Search test failed: {result['error']}")
        
        return {
            "valid": True,
            "message": "Brave API key is valid",
            "sample_results": result.get("total", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")


# --- Saved Summaries Endpoints ---

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

class ContentUpdateRequest(BaseModel):
    summary_content: str

class NoteCreateRequest(BaseModel):
    ref_text: str
    content_markdown: str

class NoteUpdateRequest(BaseModel):
    content_markdown: str

@app.post("/api/saved/{summary_id}/notes")
def add_summary_note(summary_id: str, request: NoteCreateRequest):
    note_data = {
        "ref_text": request.ref_text,
        "content_markdown": request.content_markdown
    }
    result = storage_manager.add_note_to_summary(summary_id, note_data)
    if not result:
        raise HTTPException(status_code=404, detail="Summary not found")
    return result

@app.put("/api/saved/{summary_id}/notes/{note_id}")
def update_summary_note(summary_id: str, note_id: str, request: NoteUpdateRequest):
    note_data = {
        "content_markdown": request.content_markdown
    }
    result = storage_manager.update_note_in_summary(summary_id, note_id, note_data)
    if not result:
        raise HTTPException(status_code=404, detail="Summary or Note not found")
    return result

@app.delete("/api/saved/{summary_id}/notes/{note_id}")
def delete_summary_note(summary_id: str, note_id: str):
    success = storage_manager.delete_note_from_summary(summary_id, note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Summary or Note not found")
    return {"status": "success", "id": note_id}

@app.put("/api/saved/{summary_id}/content")
def update_summary_content(summary_id: str, request: ContentUpdateRequest):
    success = storage_manager.update_summary_content(summary_id, request.summary_content)
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
    updated_book = storage_manager.update_book_metadata(book_id, request.title, request.author, request.isbn, request.genre)
    if not updated_book:
        raise HTTPException(status_code=404, detail="Book not found")
    return updated_book

@app.delete("/api/books/{book_id}")
def delete_book(book_id: str):
    success = storage_manager.delete_book(book_id)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"status": "success", "id": book_id}

@app.post("/api/share/notion")
async def share_to_notion(req: NotionShareRequest):
    config = config_manager.load_config()
    api_key = config.get("notion_api_key")
    database_id = config.get("notion_database_id")
    
    if not api_key or not database_id:
        raise HTTPException(
            status_code=400, 
            detail="Konfigurasi Notion belum lengkap. Harap atur API Key dan Database ID di pengaturan."
        )
    
    manager = NotionManager(api_key, database_id)
    result = manager.create_summary_page(
        title=req.title, 
        author=req.author, 
        summary_content=req.summary_content, 
        metadata=req.metadata
    )
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result


if __name__ == "__main__":
    import uvicorn
    # Get port from environment variable for cloud deployment
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False if os.environ.get("PORT") else True)

