from pathlib import Path

import pytest

from app.ai.config import find_config_path


def test_find_config_path_finds_repo_level_config_from_backend_module_path(tmp_path: Path):
    repo_root = tmp_path / "repo"
    backend_ai_dir = repo_root / "backend" / "app" / "ai"
    backend_ai_dir.mkdir(parents=True)
    config_path = repo_root / "config.json"
    config_path.write_text('{"ai": {}}', encoding="utf-8")

    assert find_config_path(backend_ai_dir / "config.py") == config_path


def test_find_config_path_finds_container_level_config_from_backend_module_path(tmp_path: Path):
    backend_ai_dir = tmp_path / "app" / "backend" / "app" / "ai"
    backend_ai_dir.mkdir(parents=True)
    config_path = tmp_path / "app" / "config.json"
    config_path.write_text('{"ai": {}}', encoding="utf-8")

    assert find_config_path(backend_ai_dir / "config.py") == config_path


def test_find_config_path_raises_clear_error_when_config_is_missing(tmp_path: Path):
    missing_module_path = tmp_path / "backend" / "app" / "ai" / "config.py"
    missing_module_path.parent.mkdir(parents=True)

    with pytest.raises(FileNotFoundError, match="Could not find config.json"):
        find_config_path(missing_module_path)
