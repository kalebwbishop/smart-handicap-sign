from __future__ import annotations

import numpy as np
import torch

from ai.config import INFERENCE_CONFIG, SIGNAL_CONFIG, get_runtime_checkpoint_path
from ai.model import WaveDetector

SEQ_LEN = SIGNAL_CONFIG["sample_count"]
MAX_VAL = SIGNAL_CONFIG["max_value"]
DEFAULT_CHECKPOINT = str(get_runtime_checkpoint_path())


class WaveClassifier:
    """Classifies ADC samples with the trained wave-detection checkpoint."""

    def __init__(
        self,
        checkpoint_path: str = DEFAULT_CHECKPOINT,
        device: str | None = None,
    ) -> None:
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = WaveDetector()
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

    @torch.no_grad()
    def classify(
        self,
        signal: list[int] | np.ndarray,
        threshold: float = INFERENCE_CONFIG["threshold"],
    ) -> dict[str, str | float]:
        arr = np.asarray(signal, dtype=np.float64)
        if arr.shape != (SEQ_LEN,):
            raise ValueError(f"Expected {SEQ_LEN} samples, got {arr.shape}")
        if arr.min() < 0 or arr.max() > MAX_VAL:
            raise ValueError(f"Values must be in 0-{MAX_VAL}")

        values = torch.tensor(arr / MAX_VAL, dtype=torch.float32)
        probability = self.model(values.unsqueeze(0).unsqueeze(0).to(self.device)).item()
        return {
            "label": "wave" if probability >= threshold else "non-wave",
            "confidence": round(probability, 4),
        }
