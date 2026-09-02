"""
Inference utility for the wave-detection model.

Usage
-----
As a library (inside the backend service):
    from app.ai.infer import WaveClassifier
    clf = WaveClassifier()
    result = clf.classify([1234, 3210, ...])   # list matching the configured sample count (0-4095)
    print(result)  # {"label": "wave", "confidence": 0.97}
"""

from __future__ import annotations

import numpy as np
import torch

from app.ai.config import (
    INFERENCE_CONFIG,
    SIGNAL_CONFIG,
    get_runtime_checkpoint_path,
)
from app.ai.model import WaveDetector

SEQ_LEN = SIGNAL_CONFIG["sample_count"]
# ESP32 ADC is configured for 12-bit resolution (0–4095), and the shared AI
# config now uses the same range for both training and runtime inference.
MAX_VAL = SIGNAL_CONFIG["max_value"]

DEFAULT_CHECKPOINT = str(get_runtime_checkpoint_path())


class WaveClassifier:
    """Thin wrapper around a trained :class:`WaveDetector` checkpoint."""

    def __init__(self, checkpoint_path: str = DEFAULT_CHECKPOINT, device: str | None = None):
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))

        self.model = WaveDetector()
        ckpt = torch.load(checkpoint_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(ckpt["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

    @torch.no_grad()
    def classify(
        self, signal: list[int] | np.ndarray, threshold: float = INFERENCE_CONFIG["threshold"]
    ) -> dict[str, str | float]:
        """
        Classify a signal matching the configured sample count.

        Parameters
        ----------
        signal : list[int] | ndarray
            Exactly the configured sample count integers in the range 0-4095 (ESP32 12-bit ADC).
        threshold : float
            Decision boundary (default 0.5).

        Returns
        -------
        dict with keys ``label`` (``"wave"`` | ``"non-wave"``) and ``confidence`` (float).
        """
        arr = np.asarray(signal, dtype=np.float64)
        if arr.shape != (SEQ_LEN,):
            raise ValueError(f"Expected {SEQ_LEN} samples, got {arr.shape}")
        if arr.min() < 0 or arr.max() > MAX_VAL:
            raise ValueError(f"Values must be in 0-{MAX_VAL}")

        x = torch.tensor(arr / MAX_VAL, dtype=torch.float32).unsqueeze(0).unsqueeze(0)  # (1, 1, SEQ_LEN)
        x = x.to(self.device)

        prob = self.model(x).item()
        label = "wave" if prob >= threshold else "non-wave"
        return {"label": label, "confidence": round(prob, 4)}
