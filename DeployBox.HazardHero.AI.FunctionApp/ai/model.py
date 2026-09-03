from __future__ import annotations

import torch
import torch.nn as nn

from ai.config import MODEL_CONFIG, SIGNAL_CONFIG

DEFAULT_DROPOUT = MODEL_CONFIG["dropout"]
_CONV_BLOCKS = MODEL_CONFIG["conv_blocks"]
SEQ_LEN = SIGNAL_CONFIG["sample_count"]


class WaveDetector(nn.Module):
    """Three-block 1-D convolutional network for binary wave detection."""

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
        x = self.features(x)
        x = x.squeeze(-1)
        return self.classifier(x)
