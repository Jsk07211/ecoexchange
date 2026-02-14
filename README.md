# EcoExchange

Citizen-science data exchange platform. Next.js frontend + FastAPI backend.

## Quick Start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/programs` | List programs (query: `category`, `status`, `search`) |
| GET | `/api/programs/{id}` | Get single program |
| GET | `/api/datasets` | List datasets (query: `category`, `search`, `sort_by`, `sort_dir`) |
| GET | `/api/datasets/{id}` | Get single dataset |
| POST | `/api/submissions` | Submit an observation |
| POST | `/api/uploads` | Upload files for AI filtering |
| GET | `/api/categories` | List categories |
| GET | `/api/statuses` | List statuses |

## AI Upload Filter

The upload endpoint at `POST /api/uploads` accepts multipart file uploads (PDFs, images, CSVs) and runs each file through an AI filter. Currently the filter is a stub that accepts everything. Below is how to implement real filtering.

### Current behavior

Every uploaded file passes through `_ai_filter()` in `backend/routes/uploads.py`. The stub accepts all files and returns:

```json
{
  "filename": "data.csv",
  "file_type": "csv",
  "size": 1024,
  "accepted": true,
  "reason": "Passed (AI filter not yet active)",
  "ai_tags": [],
  "ai_confidence": null
}
```

### How to add real AI filtering

Edit the single function `_ai_filter()` in `backend/routes/uploads.py`. It receives three arguments:

- `file` -- the FastAPI `UploadFile` object (has `.filename`, `.content_type`)
- `file_type` -- detected type string: `"pdf"`, `"image"`, `"csv"`, or `"unknown"`
- `contents` -- the raw file bytes, already read

Replace the stub body with your AI logic. Example using the Anthropic SDK:

```python
import anthropic
import base64

client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var

async def _ai_filter(file: UploadFile, file_type: str, contents: bytes) -> UploadFilterResult:
    if file_type == "image":
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": file.content_type, "data": base64.b64encode(contents).decode()}},
                    {"type": "text", "text": "Classify this image for a citizen-science dataset. Return JSON with keys: accepted (bool), reason (str), tags (list of str), confidence (float 0-1)."}
                ]
            }]
        )
        result = json.loads(response.content[0].text)
    elif file_type == "csv":
        preview = contents[:2000].decode(errors="replace")
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=256,
            messages=[{"role": "user", "content": f"Validate this CSV for ecological data quality. First 2000 chars:\n{preview}\nReturn JSON: accepted, reason, tags, confidence."}]
        )
        result = json.loads(response.content[0].text)
    elif file_type == "pdf":
        # Use base64 PDF input or extract text first
        result = {"accepted": True, "reason": "PDF received", "tags": [], "confidence": 0.5}
    else:
        result = {"accepted": False, "reason": "Unsupported file type", "tags": [], "confidence": 1.0}

    return UploadFilterResult(
        filename=file.filename or "unnamed",
        file_type=file_type,
        size=len(contents),
        accepted=result["accepted"],
        reason=result["reason"],
        ai_tags=result.get("tags", []),
        ai_confidence=result.get("confidence"),
    )
```

When adding real AI, update `backend/requirements.txt`:

```
anthropic>=0.40.0
```

And pass the API key via `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

### Pydantic models

The response schema is defined in `backend/models/upload.py`:

- `UploadFilterResult` -- per-file result with `accepted`, `reason`, `ai_tags`, `ai_confidence`
- `UploadResponse` -- summary with `total_files`, `accepted`, `rejected`, and list of results

### Frontend usage

```typescript
import { uploadFiles } from "@/lib/api/uploads"

const response = await uploadFiles(selectedFiles)
// response.results[0].accepted, .reason, .aiTags, .aiConfidence
```

## Project Structure

```
backend/
  main.py              # FastAPI app, CORS, router includes
  requirements.txt     # Python dependencies
  models/              # Pydantic models
  data/                # Hardcoded dummy data
  routes/              # API route handlers
    uploads.py         # File upload + AI filter (edit _ai_filter here)
lib/
  types.ts             # Shared TypeScript interfaces
  api/                 # Typed fetch wrappers
components/            # React components (fetch from API)
```

## Local Development (without Docker)

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd .. && uvicorn backend.main:app --reload
```

Frontend:

```bash
pnpm install
pnpm dev
```
