from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from functools import lru_cache
from typing import Any

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobClient


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


def get_runtime_checkpoint_path() -> Path:
    model_blob_url = os.environ.get("MODEL_BLOB_URL")
    if model_blob_url:
        return download_model_checkpoint(model_blob_url)

    configured_path = CONFIG_PATH.parent / PATHS_CONFIG["runtime_checkpoint_dir"]
    if configured_path.is_file():
        return configured_path
    return Path(__file__).with_name("checkpoints") / PATHS_CONFIG["checkpoint_name"]


@lru_cache(maxsize=4)
def download_model_checkpoint(model_blob_url: str) -> Path:
    model_path = Path(tempfile.gettempdir()) / "hazard-hero-models" / PATHS_CONFIG["checkpoint_name"]
    model_path.parent.mkdir(parents=True, exist_ok=True)

    if model_path.is_file():
        return model_path

    temporary_path = model_path.with_suffix(".tmp")
    blob_client = BlobClient.from_blob_url(
        model_blob_url,
        credential=DefaultAzureCredential(),
    )

    with temporary_path.open("wb") as model_file:
        blob_client.download_blob().readinto(model_file)

    temporary_path.replace(model_path)
    return model_path
