import cv2
import numpy as np
from pathlib import Path

def is_blurry(img: np.ndarray, threshold_pct: float = 10.0) -> bool:
    # Laplacian variance empirical range 0–1000
    return bool(cv2.Laplacian(img, cv2.CV_64F).var() < (threshold_pct / 100) * 1000)

def check_exposure(img: np.ndarray, min_pct: float = 19.6, max_pct: float = 78.4) -> str:
    mean = img.mean()
    if mean < (min_pct / 100) * 255: return "underexposed"
    if mean > (max_pct / 100) * 255: return "overexposed"
    return "ok"

def is_noisy(img: np.ndarray, threshold_pct: float = 33.0) -> bool:
    # mean absolute difference empirical range 0–30
    denoised = cv2.GaussianBlur(img.astype(float), (5, 5), 0)
    return bool(np.mean(np.abs(img.astype(float) - denoised)) > (threshold_pct / 100) * 30)

def is_low_contrast(img: np.ndarray, threshold_pct: float = 19.6) -> bool:
    # std dev on 0–255 scale
    return bool(img.std() < (threshold_pct / 100) * 255)

def is_low_resolution(img: np.ndarray, min_resolution: tuple[int, int] = (640, 480)) -> bool:
    h, w = img.shape
    return bool(w < min_resolution[0] or h < min_resolution[1])

def check_quality(image_path: str) -> dict:
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    return {
        "blurry":         is_blurry(img),
        "exposure":       check_exposure(img),
        "noisy":          is_noisy(img),
        "low_contrast":   is_low_contrast(img),
        "low_resolution": is_low_resolution(img),
    }


for f in Path("./test_images").iterdir():
    print(f"{f}: {check_quality(f)}\n")


