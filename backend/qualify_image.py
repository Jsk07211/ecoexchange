"""Image quality checks using OpenCV.

Each check returns a (passed: bool, reason: str) tuple.
``check_quality`` aggregates all checks into a score + list of warnings.
"""

import cv2
import numpy as np


def _check_blur(gray: np.ndarray) -> tuple[bool, str]:
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    threshold = 100.0  # 10% of empirical 0-1000 range
    if variance < threshold:
        return False, f"Blurry because the image sharpness is very low (Laplacian variance {variance:.0f}, needs >{threshold:.0f})"
    return True, ""


def _check_exposure(gray: np.ndarray) -> tuple[bool, str]:
    mean = float(gray.mean())
    if mean < 50:  # ~19.6% of 255
        return False, f"Underexposed because the average brightness is too dark ({mean:.0f}/255)"
    if mean > 200:  # ~78.4% of 255
        return False, f"Overexposed because the average brightness is too high ({mean:.0f}/255)"
    return True, ""


def _check_noise(gray: np.ndarray) -> tuple[bool, str]:
    denoised = cv2.GaussianBlur(gray.astype(float), (5, 5), 0)
    noise_level = float(np.mean(np.abs(gray.astype(float) - denoised)))
    threshold = 10.0  # 33% of empirical 0-30 range
    if noise_level > threshold:
        return False, f"Noisy because the noise level is high ({noise_level:.1f}, max {threshold:.0f})"
    return True, ""


def _check_contrast(gray: np.ndarray) -> tuple[bool, str]:
    std = float(gray.std())
    threshold = 50.0  # ~19.6% of 255
    if std < threshold:
        return False, f"Low contrast because the tonal range is narrow (std dev {std:.0f}, needs >{threshold:.0f})"
    return True, ""


def _check_resolution(gray: np.ndarray, min_w: int = 640, min_h: int = 480) -> tuple[bool, str]:
    h, w = gray.shape
    if w < min_w or h < min_h:
        return False, f"Low resolution because the image is {w}x{h}px (minimum {min_w}x{min_h})"
    return True, ""


def check_quality(image_bytes: bytes) -> dict:
    """Run all quality checks on raw image bytes.

    Returns::

        {
            "score": 80.0,       # 0-100, each failed check deducts 20
            "passed": True,      # score >= 40 (warn but allow)
            "warnings": [        # list of human-readable issues
                {"check": "blur", "message": "Blurry because ..."},
            ],
        }
    """
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)

    if img is None:
        return {
            "score": 0.0,
            "passed": False,
            "warnings": [{"check": "decode", "message": "Could not decode image file"}],
        }

    checks = [
        ("blur", _check_blur),
        ("exposure", _check_exposure),
        ("noise", _check_noise),
        ("contrast", _check_contrast),
        ("resolution", _check_resolution),
    ]

    warnings: list[dict[str, str]] = []
    for name, fn in checks:
        passed, reason = fn(img)
        if not passed:
            warnings.append({"check": name, "message": reason})

    deduction_per_issue = 20.0
    score = max(0.0, 100.0 - len(warnings) * deduction_per_issue)

    return {
        "score": score,
        "passed": True,  # always allow upload, warnings are informational
        "warnings": warnings,
    }
