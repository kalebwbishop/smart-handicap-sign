from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def find_config_path(start_path: Path | None = None) -> Path:
    resolved_start = (start_path or Path(__file__)).resolve()
    search_roots = [resolved_start.parent] if resolved_start.is_file() else [resolved_start]
    search_roots.extend(resolved_start.parents)

    for root in search_roots:
        candidate = root / "config.json"
        if candidate.is_file():
            return candidate

    raise FileNotFoundError(f"Could not find config.json relative to {resolved_start}")


CONFIG_PATH = find_config_path()


@lru_cache
def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as config_file:
        return json.load(config_file)["ai"]


CONFIG = load_config()
SIGNAL_CONFIG = CONFIG["signal"]
PATHS_CONFIG = CONFIG["paths"]
MODEL_CONFIG = CONFIG["model"]
INFERENCE_CONFIG = CONFIG["inference"]


def get_runtime_checkpoint_dir() -> Path:
    return CONFIG_PATH.parent / PATHS_CONFIG["runtime_checkpoint_dir"]


def get_runtime_checkpoint_path() -> Path:
    return get_runtime_checkpoint_dir() / PATHS_CONFIG["checkpoint_name"]
