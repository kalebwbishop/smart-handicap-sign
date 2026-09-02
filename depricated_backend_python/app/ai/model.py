"""
Lightweight 1-D CNN for binary wave detection.

Input  : (batch, 1, SEQ_LEN)   — single-channel signal normalised to [0, 1]
Output : (batch, 1)        — probability that the signal contains a periodic wave
"""

from __future__ import annotations

import torch
import torch.nn as nn

from app.ai.config import MODEL_CONFIG, SIGNAL_CONFIG

DEFAULT_DROPOUT = MODEL_CONFIG["dropout"]
_CONV_BLOCKS = MODEL_CONFIG["conv_blocks"]
SEQ_LEN = SIGNAL_CONFIG["sample_count"]


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

    def __init__(self, dropout: float = DEFAULT_DROPOUT) -> None:
        super().__init__()

        feature_layers: list[nn.Module] = []
        for block in _CONV_BLOCKS:
            feature_layers.extend(
                [
                    nn.Conv1d(
                        block["in_channels"],
                        block["out_channels"],
                        kernel_size=block["kernel_size"],
                        padding=block["padding"],
                    ),
                    nn.BatchNorm1d(block["out_channels"]),
                    nn.ReLU(inplace=True),
                ]
            )
            if "pool_size" in block:
                feature_layers.append(nn.MaxPool1d(kernel_size=block["pool_size"]))
            else:
                feature_layers.append(nn.AdaptiveAvgPool1d(1))

        self.features = nn.Sequential(*feature_layers)

        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : Tensor of shape (batch, 1, SEQ_LEN)

        Returns
        -------
        Tensor of shape (batch, 1) — probability of the signal being a wave.
        """
        x = self.features(x)       # (batch, 128, 1)
        x = x.squeeze(-1)          # (batch, 128)
        x = self.classifier(x)     # (batch, 1)
        return x
