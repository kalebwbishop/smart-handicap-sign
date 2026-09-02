import logging
import sys
from pathlib import Path

from app.config.settings import get_settings


def _setup_logger() -> logging.Logger:
    settings = get_settings()

    log = logging.getLogger("app")
    log.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    # Console handler with colour-friendly format
    # Use UTF-8 stream to avoid UnicodeEncodeError on Windows (cp1252)
    utf8_stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False)
    console = logging.StreamHandler(utf8_stdout)
    console.setLevel(logging.DEBUG)
    console_fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console.setFormatter(console_fmt)
    log.addHandler(console)

    # File handlers
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    # Error log
    error_handler = logging.FileHandler(log_dir / "error.log", encoding="utf-8")
    error_handler.setLevel(logging.ERROR)
    file_fmt = logging.Formatter(
        '{"time": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}',
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    error_handler.setFormatter(file_fmt)
    log.addHandler(error_handler)

    # Combined log
    combined_handler = logging.FileHandler(log_dir / "combined.log", encoding="utf-8")
    combined_handler.setLevel(logging.DEBUG)
    combined_handler.setFormatter(file_fmt)
    log.addHandler(combined_handler)

    return log


logger = _setup_logger()
