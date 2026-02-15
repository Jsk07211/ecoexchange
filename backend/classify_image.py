"""
Image classification using MobileNetV2 (ImageNet pretrained).

Adapted from the image-verification branch. Uses PyTorch directly —
no ExecuTorch runtime needed. Classifies images and checks whether
the detected label matches an expected category (e.g. "bird").
"""

import io
from functools import lru_cache

import torch
import torchvision.models as models
from PIL import Image
from torchvision.models.mobilenetv2 import MobileNet_V2_Weights

WEIGHTS = MobileNet_V2_Weights.DEFAULT
LABELS: list[str] = WEIGHTS.meta["categories"]

# ImageNet indices for bird species
BIRD_INDICES: set[int] = set(range(7, 25)) | set(range(80, 101)) | set(range(127, 146))

# Build a category → indices map for quick lookups
# We can expand this with more categories as needed
CATEGORY_INDICES: dict[str, set[int]] = {
    "bird": BIRD_INDICES,
}


@lru_cache(maxsize=1)
def _get_model():
    model = models.mobilenet_v2(weights=WEIGHTS).eval()
    return model


def classify(image_bytes: bytes, confidence_threshold: float = 0.15) -> dict:
    """Classify an image and return label + confidence.

    Returns:
        {
            "label": str,          # ImageNet label or "unknown"
            "confidence": float,   # 0.0-1.0
            "top5": [{"label": str, "confidence": float}, ...]
        }
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = WEIGHTS.transforms()(img).unsqueeze(0)

    with torch.no_grad():
        logits = _get_model()(tensor)

    probs = torch.softmax(logits.squeeze(), dim=0)
    top5_probs, top5_indices = probs.topk(5)

    top_idx = top5_indices[0].item()
    top_prob = top5_probs[0].item()

    label = LABELS[top_idx] if top_prob >= confidence_threshold else "unknown"

    top5 = [
        {"label": LABELS[idx.item()], "confidence": round(prob.item(), 4)}
        for idx, prob in zip(top5_indices, top5_probs)
    ]

    return {
        "label": label,
        "confidence": round(top_prob, 4),
        "top5": top5,
    }


def check_category(image_bytes: bytes, expected_category: str) -> dict:
    """Classify an image and check if it matches the expected category.

    Returns:
        {
            "label": str,
            "confidence": float,
            "matches": bool,
            "expected_category": str,
            "message": str,
        }
    """
    result = classify(image_bytes)
    label = result["label"]
    confidence = result["confidence"]

    expected_lower = expected_category.lower()
    expected_indices = CATEGORY_INDICES.get(expected_lower)

    if expected_indices is not None:
        # Use the known index set for this category
        top_idx = LABELS.index(label) if label in LABELS else -1
        matches = top_idx in expected_indices
    else:
        # Fallback: check if expected category appears in the label text
        matches = expected_lower in label.lower()

    if matches:
        message = f"CNN detected: {label} ({confidence:.0%} confidence)"
    elif label == "unknown":
        message = f"CNN could not identify the image (low confidence: {confidence:.0%})"
    else:
        message = f"CNN detected: {label} ({confidence:.0%}) — expected {expected_category}"

    return {
        "label": label,
        "confidence": confidence,
        "matches": matches,
        "expected_category": expected_category,
        "message": message,
    }
