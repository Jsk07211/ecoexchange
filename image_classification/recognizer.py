import os
import torch
import numpy as np
import cv2
from PIL import Image
from torchvision.models.mobilenetv2 import MobileNet_V2_Weights
from dotenv import load_dotenv
from executorch.runtime import Runtime
import torchvision.models as models
from nltk.corpus import wordnet

load_dotenv()
MODEL_PATH = os.getenv("MODEL_PATH", f"model_{os.getenv('BACKEND', 'xnnpack')}.pte")
WEIGHTS = MobileNet_V2_Weights.DEFAULT
LABELS: list[str] = WEIGHTS.meta["categories"]

# ImageNet indices for bird species (indices 7-24 and 80-145)
# 7=cock, 8=hen, 9=ostrich, 10=brambling, 11=goldfinch, 12=house finch,
# 13=junco, 14=indigo bunting, 15=robin, 16=bulbul, 17=jay, 18=magpie,
# 19=chickadee, 20=water ouzel, 21=kite, 22=bald eagle, 23=vulture, 24=great grey owl,
# 80=black grouse, 81=ptarmigan, 82=ruffed grouse, 83=prairie chicken, 84=peacock,
# 85=quail, 86=partridge, 87=African grey, 88=macaw, 89=cockatoo, 90=lorikeet,
# 91=coucal, 92=bee eater, 93=hornbill, 94=hummingbird, 95=jacamar, 96=toucan,
# 97=drake, 98=red-breasted merganser, 99=goose, 100=black swan,
# 127=white stork, 128=black stork, 129=spoonbill, 130=flamingo,
# 131=little blue heron, 132=American egret, 133=bittern, 134=crane,
# 135=limpkin, 136=European gallinule, 137=American coot, 138=bustard,
# 139=ruddy turnstone, 140=red-backed sandpiper, 141=redshank, 142=dowitcher,
# 143=oystercatcher, 144=pelican, 145=king penguin
BIRD_INDICES: set[int] = set(range(7, 25)) | set(range(80, 101)) | set(range(127, 146))

# WordNet animal synset — all descendants are animals

_ANIMAL = wordnet.synsets("animal")[0]

def _is_animal(label: str) -> bool:
    """Check if label is an animal using WordNet hierarchy."""
    # use first part before comma, try each word
    for word in label.split(",")[0].replace("-", "_").split():
        for syn in wordnet.synsets(word):
            if any(_ANIMAL in path for path in syn.hypernym_paths()):
                return True
    return False

# cache results — labels are fixed, no need to recheck
_animal_cache: dict[str, bool] = {}

def _check_animal(label: str) -> bool:
    if label not in _animal_cache:
        _animal_cache[label] = _is_animal(label)
    return _animal_cache[label]

# Use PyTorch directly for inference — ExecuTorch runtime has a known bug
# on Windows with torch nightly (2.10.0). The .pte export is still valid
# for deploying to mobile devices.
_model = None

def _get_model():
    global _model
    if _model is None:
        _model = models.mobilenet_v2(weights=WEIGHTS).eval()
    return _model
'''
def classify(image_path: str, confidence_threshold: float = 0.3) -> dict:
    tensor = WEIGHTS.transforms()(Image.open(image_path).convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        logits = _get_model()(tensor)
    probs = torch.softmax(logits.squeeze(), dim=0)
    top_prob, top_idx = probs.max(dim=0)
    top_idx, top_prob = top_idx.item(), top_prob.item()
    return {
        "valid":      top_idx in BIRD_INDICES and top_prob >= confidence_threshold,
        "label":      LABELS[top_idx],
        "confidence": top_prob,
    }
'''
def classify(image_path: str, confidence_threshold: float = 0.3) -> dict:
    tensor = WEIGHTS.transforms()(Image.open(image_path).convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        logits = _get_model()(tensor)
    probs = torch.softmax(logits.squeeze(), dim=0)
    top_prob, top_idx = probs.max(dim=0)
    top_idx, top_prob = top_idx.item(), top_prob.item()
    label = LABELS[top_idx]
    is_animal = top_idx in BIRD_INDICES or _check_animal(label)
    return {
        "label":      label if is_animal and top_prob >= confidence_threshold else "invalid",
        "confidence": top_prob,
    }


print(classify("trail_deer.jpg"))
