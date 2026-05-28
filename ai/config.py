from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"


@lru_cache
def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as config_file:
        return json.load(config_file)["ai"]


CONFIG = load_config()
SIGNAL_CONFIG = CONFIG["signal"]
PATHS_CONFIG = CONFIG["paths"]
MODEL_CONFIG = CONFIG["model"]
DATASET_CONFIG = CONFIG["dataset"]
TRAINING_CONFIG = CONFIG["training"]
INFERENCE_CONFIG = CONFIG["inference"]


def get_training_checkpoint_dir() -> Path:
    return CONFIG_PATH.parent / PATHS_CONFIG["training_checkpoint_dir"]


def get_training_checkpoint_path() -> Path:
    return get_training_checkpoint_dir() / PATHS_CONFIG["checkpoint_name"]
