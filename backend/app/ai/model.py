"""
Lightweight 1-D CNN for binary wave detection.

Input  : (batch, 1, 512)   — single-channel signal normalised to [0, 1]
Output : (batch, 1)        — probability that the signal contains a periodic wave
"""

from __future__ import annotations

import torch
import torch.nn as nn


class WaveDetector(nn.Module):
    """
    Three-block 1-D convnet → global average pool → fully-connected head.

    Architecture
    ------------
    Block 1 : Conv1d(1  → 32,  k=7, p=3) → BatchNorm → ReLU → MaxPool(2)
    Block 2 : Conv1d(32 → 64,  k=5, p=2) → BatchNorm → ReLU → MaxPool(2)
    Block 3 : Conv1d(64 → 128, k=3, p=1) → BatchNorm → ReLU → AdaptiveAvgPool(1)
    Head    : Dropout(0.3) → Linear(128 → 1) → Sigmoid
    """

    def __init__(self, dropout: float = 0.3) -> None:
        super().__init__()

        self.features = nn.Sequential(
            # Block 1  — 512 → 256
            nn.Conv1d(1, 32, kernel_size=7, padding=3),
            nn.BatchNorm1d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=2),

            # Block 2  — 256 → 128
            nn.Conv1d(32, 64, kernel_size=5, padding=2),
            nn.BatchNorm1d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=2),

            # Block 3  — 128 → 1 (global avg pool)
            nn.Conv1d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm1d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool1d(1),               # (batch, 128, 1)
        )

        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : Tensor of shape (batch, 1, 512)

        Returns
        -------
        Tensor of shape (batch, 1) — probability of the signal being a wave.
        """
        x = self.features(x)       # (batch, 128, 1)
        x = x.squeeze(-1)          # (batch, 128)
        x = self.classifier(x)     # (batch, 1)
        return x
