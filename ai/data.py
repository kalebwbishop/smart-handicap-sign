"""
Synthetic dataset for wave detection.

Generates 512-sample integer signals (0-65535) in four categories:
  - sine wave      (label = 1)
  - square wave    (label = 1)
  - random noise   (label = 0)
  - silence / DC   (label = 0)

Each sample is normalised to 0.0-1.0 before being returned as a tensor.
"""

from __future__ import annotations

import numpy as np
import torch
from torch.utils.data import Dataset

MAX_VAL = 2**16 - 1  # 65535


# ── helpers ──────────────────────────────────────────────────────────────────


def _random_sine(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate a sine wave with random frequency, amplitude, phase, and DC offset."""
    # 1-32 full cycles across 512 samples keeps the signal clearly periodic
    cycles = rng.uniform(1, 32)
    freq = cycles * 2 * np.pi / n
    phase = rng.uniform(0, 2 * np.pi)

    amplitude = rng.uniform(0.15, 0.5) * MAX_VAL  # 15-50 % of full range
    dc_offset = rng.uniform(0.25, 0.75) * MAX_VAL

    t = np.arange(n, dtype=np.float64)
    signal = dc_offset + amplitude * np.sin(freq * t + phase)

    # Add a touch of noise so the model doesn't overfit to perfectly clean waves
    noise_level = rng.uniform(0, 0.03) * MAX_VAL
    signal += rng.normal(0, noise_level, size=n)

    return np.clip(signal, 0, MAX_VAL).astype(np.float64)


def _random_square(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate a square wave with random frequency, amplitude, and DC offset."""
    cycles = rng.uniform(1, 32)
    freq = cycles * 2 * np.pi / n
    phase = rng.uniform(0, 2 * np.pi)

    amplitude = rng.uniform(0.15, 0.5) * MAX_VAL
    dc_offset = rng.uniform(0.25, 0.75) * MAX_VAL

    t = np.arange(n, dtype=np.float64)
    signal = dc_offset + amplitude * np.sign(np.sin(freq * t + phase))

    noise_level = rng.uniform(0, 0.03) * MAX_VAL
    signal += rng.normal(0, noise_level, size=n)

    return np.clip(signal, 0, MAX_VAL).astype(np.float64)


def _random_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate uniform random noise across the full 0-65535 range."""
    low = rng.uniform(0, 0.3) * MAX_VAL
    high = rng.uniform(0.7, 1.0) * MAX_VAL
    signal = rng.uniform(low, high, size=n)
    return np.clip(signal, 0, MAX_VAL).astype(np.float64)


def _random_silence(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate a near-constant (silent / DC) signal with tiny jitter."""
    dc = rng.uniform(0, MAX_VAL)
    jitter = rng.uniform(0, 0.01) * MAX_VAL
    signal = dc + rng.normal(0, jitter, size=n)
    return np.clip(signal, 0, MAX_VAL).astype(np.float64)


# ── dataset ──────────────────────────────────────────────────────────────────


_GENERATORS = {
    "sine": (_random_sine, 1),
    "square": (_random_square, 1),
    "noise": (_random_noise, 0),
    "silence": (_random_silence, 0),
}


class WaveDetectionDataset(Dataset):
    """
    On-the-fly synthetic dataset.

    Parameters
    ----------
    size : int
        Total number of samples.  Each category is equally represented.
    seq_len : int
        Number of integers per sample (default 512).
    seed : int | None
        Reproducibility seed.
    """

    def __init__(self, size: int = 50_000, seq_len: int = 512, seed: int | None = None):
        super().__init__()
        self.size = size
        self.seq_len = seq_len

        rng = np.random.default_rng(seed)
        categories = list(_GENERATORS.keys())
        n_per_cat = size // len(categories)

        signals: list[np.ndarray] = []
        labels: list[int] = []

        for cat in categories:
            gen_fn, label = _GENERATORS[cat]
            for _ in range(n_per_cat):
                signals.append(gen_fn(seq_len, rng))
                labels.append(label)

        # Fill remainder with random categories
        for _ in range(size - len(signals)):
            cat = rng.choice(categories)
            gen_fn, label = _GENERATORS[cat]
            signals.append(gen_fn(seq_len, rng))
            labels.append(label)

        # Shuffle deterministically
        order = rng.permutation(len(signals))
        self.signals = [signals[i] for i in order]
        self.labels = [labels[i] for i in order]

    def __len__(self) -> int:
        return self.size

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        signal = self.signals[idx] / MAX_VAL  # normalise → [0, 1]
        x = torch.tensor(signal, dtype=torch.float32).unsqueeze(0)  # (1, 512)
        y = torch.tensor(self.labels[idx], dtype=torch.float32)
        return x, y


if __name__ == "__main__":
    # Quick sanity check:  Display a few samples from each category.
    import matplotlib.pyplot as plt

    signal_0 = []
    signal_1 = []

    ds = WaveDetectionDataset(size=2000, seed=42)
    for label in [0, 1]:
        idx = next(i for i, y in enumerate(ds.labels) if y == label)
        signal, _ = ds[idx]
        plt.plot(signal.squeeze().numpy(), label=f"label={label}")

        if label == 0:
            signal_0 = signal.squeeze().numpy().tolist()
        else:
            signal_1 = signal.squeeze().numpy().tolist()

    plt.legend()
    plt.title("Example signals from the synthetic dataset")
    plt.show()

    print("Label 0: ", [int(MAX_VAL * x) for x in signal_0])
    print("Label 1: ", [int(MAX_VAL * x) for x in signal_1])