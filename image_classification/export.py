"""
Export MobileNetV2 to ExecuTorch .pte for bird classification.
Run once before using classify() in main.py.

BACKEND in .env: xnnpack (default), coreml (iOS, macOS only), vulkan (Android GPU)
"""

import os
import torch
import torchvision.models as models
from torchvision.models.mobilenetv2 import MobileNet_V2_Weights
from dotenv import load_dotenv
from executorch.exir import to_edge_transform_and_lower

load_dotenv()
BACKEND = os.getenv("BACKEND", "xnnpack").lower()
MODEL_PATH = os.getenv("MODEL_PATH", f"model_{BACKEND}.pte")

def get_partitioner():
    if BACKEND == "coreml":
        from executorch.backends.apple.coreml.partition.coreml_partitioner import CoreMLPartitioner
        return CoreMLPartitioner()
    if BACKEND == "vulkan":
        from executorch.backends.vulkan.partitioner.vulkan_partitioner import VulkanPartitioner
        return VulkanPartitioner()
    from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
    return XnnpackPartitioner()

def export() -> None:
    model = models.mobilenet_v2(weights=MobileNet_V2_Weights.DEFAULT).eval()
    et_program = to_edge_transform_and_lower(
        torch.export.export(model, (torch.randn(1, 3, 224, 224),)),
        partitioner=[get_partitioner()],
    ).to_executorch()
    with open(MODEL_PATH, "wb") as f:
        f.write(et_program.buffer)
    print(f"Exported {MODEL_PATH}")

if __name__ == "__main__":
    export()
