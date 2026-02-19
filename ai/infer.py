"""
Inference utility for the wave-detection model.

Usage
-----
As a library:
    from infer import WaveClassifier
    clf = WaveClassifier("checkpoints/best.pt")
    result = clf.classify([12345, 54321, ...])   # list of 512 ints (0-65535)
    print(result)  # {"label": "wave", "confidence": 0.97}

From the command line (reads a JSON array from stdin):
    echo "[100, 200, 300, ...]" | python infer.py --checkpoint checkpoints/best.pt
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
import torch

from model import WaveDetector

SEQ_LEN = 512
MAX_VAL = 2**16 - 1  # 65535

DEFAULT_CHECKPOINT = os.path.join(os.path.dirname(__file__), "checkpoints", "best.pt")


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
        self, signal: list[int] | np.ndarray, threshold: float = 0.5
    ) -> dict[str, str | float]:
        """
        Classify a single 512-int signal.

        Parameters
        ----------
        signal : list[int] | ndarray
            Exactly 512 integers in the range 0-65535.
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

        x = torch.tensor(arr / MAX_VAL, dtype=torch.float32).unsqueeze(0).unsqueeze(0)  # (1, 1, 512)
        x = x.to(self.device)

        prob = self.model(x).item()
        label = "wave" if prob >= threshold else "non-wave"
        return {"label": label, "confidence": round(prob, 4)}


# ── CLI entry-point ──────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify a 512-int signal as wave / non-wave")
    parser.add_argument(
        "--checkpoint", type=str, default=DEFAULT_CHECKPOINT, help="Path to model checkpoint",
    )
    parser.add_argument(
        "--threshold", type=float, default=0.5, help="Decision threshold",
    )
    args = parser.parse_args()

    raw = sys.stdin.read().strip()
    try:
        signal = json.loads(raw)
    except json.JSONDecodeError:
        print("Error: stdin must contain a JSON array of 512 integers.", file=sys.stderr)
        sys.exit(1)

    clf = WaveClassifier(checkpoint_path=args.checkpoint)
    result = clf.classify(signal, threshold=args.threshold)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
