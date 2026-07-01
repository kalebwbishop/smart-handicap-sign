"""
Training script for the wave-detection model.

This trainer now loads labeled captures from the real Postgres training
dataset instead of generating synthetic samples.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import time
from collections import Counter
from collections.abc import Iterable
from pathlib import Path
from random import Random
from typing import Any

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from config import SIGNAL_CONFIG, TRAINING_CONFIG, get_training_checkpoint_dir, get_training_checkpoint_path
from model import DEFAULT_DROPOUT, WaveDetector

MAX_VAL = SIGNAL_CONFIG["max_value"]
SEQ_LEN = SIGNAL_CONFIG["sample_count"]
CHECKPOINT_DIR = str(get_training_checkpoint_dir())
DEFAULT_ACCURACY_THRESHOLD = TRAINING_CONFIG["accuracy_threshold"]
DEFAULT_POSITIVE_LABELS = ("wave", "positive", "training_positive")
DEFAULT_NEGATIVE_LABELS = ("non-wave", "negative", "training_negative")
BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / "backend" / ".env"


def _accuracy(
    preds: torch.Tensor,
    targets: torch.Tensor,
    threshold: float = DEFAULT_ACCURACY_THRESHOLD,
) -> float:
    predicted = (preds >= threshold).float()
    return (predicted == targets).float().mean().item()


def _run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer | None,
    device: torch.device,
) -> tuple[float, float]:
    """Run one training or validation epoch. Pass optimizer=None for eval."""
    is_train = optimizer is not None
    model.train() if is_train else model.eval()

    total_loss = 0.0
    total_acc = 0.0
    n_batches = 0

    ctx = torch.no_grad() if not is_train else torch.enable_grad()
    with ctx:
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            out = model(x).squeeze(-1)
            loss = criterion(out, y)

            if is_train:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            total_loss += loss.item()
            total_acc += _accuracy(out, y)
            n_batches += 1

    return total_loss / n_batches, total_acc / n_batches


def _normalize_label(label: str) -> str:
    return label.strip().lower()


def _parse_label_set(raw: str) -> set[str]:
    return {_normalize_label(label) for label in raw.split(",") if label.strip()}


def _capture_label_to_target(
    capture_label: str,
    positive_labels: set[str],
    negative_labels: set[str],
) -> float | None:
    label = _normalize_label(capture_label)
    if label in positive_labels:
        return 1.0
    if label in negative_labels:
        return 0.0
    return None


def _coerce_samples(raw_samples: Any) -> list[int]:
    if isinstance(raw_samples, str):
        raw_samples = json.loads(raw_samples)
    if not isinstance(raw_samples, Iterable):
        raise ValueError("samples must be an array of integers")

    samples = [int(value) for value in raw_samples]
    if len(samples) != SEQ_LEN:
        raise ValueError(f"Expected {SEQ_LEN} samples, got {len(samples)}")
    if any(value < 0 or value > MAX_VAL for value in samples):
        raise ValueError(f"Samples must be in range 0-{MAX_VAL}")
    return samples


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("export "):
            stripped = stripped[len("export ") :].strip()
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        values[key] = value
    return values


def _resolve_postgres_dsn(explicit_dsn: str | None = None) -> str:
    if explicit_dsn:
        return explicit_dsn

    for env_key in ("POSTGRES_CONNECTION_STRING", "DATABASE_URL"):
        value = os.environ.get(env_key)
        if value:
            return value

    env_values = _read_env_file(BACKEND_ENV_PATH)
    for env_key in ("POSTGRES_CONNECTION_STRING", "DATABASE_URL"):
        value = env_values.get(env_key)
        if value:
            return value

    raise RuntimeError(
        "No Postgres DSN found. Set POSTGRES_CONNECTION_STRING or DATABASE_URL, "
        "or keep backend/.env populated."
    )


async def _fetch_training_rows(
    dsn: str,
    *,
    positive_labels: set[str],
    negative_labels: set[str],
    limit: int | None = None,
) -> list[dict[str, Any]]:
    import asyncpg

    conn = await asyncpg.connect(dsn=dsn)
    try:
        query = """
            SELECT
                device_serial_number,
                capture_label,
                firmware_version,
                sample_count,
                sample_interval_ms,
                samples,
                created_at
            FROM training_captures
            WHERE lower(trim(capture_label)) = ANY($1::text[])
               OR lower(trim(capture_label)) = ANY($2::text[])
            ORDER BY created_at ASC
        """
        params: list[Any] = [list(positive_labels), list(negative_labels)]
        if limit is not None:
            query += " LIMIT $3"
            params.append(limit)
        rows = await conn.fetch(query, *params)
        return [dict(row) for row in rows]
    finally:
        await conn.close()


def _row_to_example(
    row: dict[str, Any],
    *,
    positive_labels: set[str],
    negative_labels: set[str],
) -> tuple[torch.Tensor, torch.Tensor] | None:
    target = _capture_label_to_target(
        row["capture_label"],
        positive_labels=positive_labels,
        negative_labels=negative_labels,
    )
    if target is None:
        return None

    samples = _coerce_samples(row["samples"])
    expected_count = int(row.get("sample_count", len(samples)))
    if expected_count != len(samples):
        raise ValueError(
            f"Sample count mismatch for capture {row.get('device_serial_number', '<unknown>')}: "
            f"expected {expected_count}, got {len(samples)}"
        )

    signal = torch.tensor(samples, dtype=torch.float32).div(MAX_VAL).unsqueeze(0)
    label = torch.tensor(target, dtype=torch.float32)
    return signal, label


def _stack_examples(examples: list[tuple[torch.Tensor, torch.Tensor]]) -> TensorDataset:
    if not examples:
        raise ValueError("No labeled captures available for training")

    signals = torch.stack([signal for signal, _ in examples])
    labels = torch.stack([label for _, label in examples])
    return TensorDataset(signals, labels)


def _stratified_split(
    examples: list[tuple[torch.Tensor, torch.Tensor]],
    *,
    seed: int,
    train_cap: int,
    val_cap: int,
) -> tuple[list[tuple[torch.Tensor, torch.Tensor]], list[tuple[torch.Tensor, torch.Tensor]]]:
    positives = [example for example in examples if math.isclose(float(example[1].item()), 1.0, rel_tol=1e-9, abs_tol=1e-9)]
    negatives = [example for example in examples if math.isclose(float(example[1].item()), 0.0, rel_tol=1e-9, abs_tol=1e-9)]

    if not positives or not negatives:
        raise ValueError("Need both positive and negative labeled captures to train")

    rng = Random(seed)
    rng.shuffle(positives)
    rng.shuffle(negatives)

    val_ratio = val_cap / max(train_cap + val_cap, 1)

    def split_group(group: list[tuple[torch.Tensor, torch.Tensor]]) -> tuple[list[tuple[torch.Tensor, torch.Tensor]], list[tuple[torch.Tensor, torch.Tensor]]]:
        if len(group) <= 1 or val_ratio <= 0:
            return group[:], []

        val_count = int(round(len(group) * val_ratio))
        val_count = max(1, min(val_count, len(group) - 1))
        return group[:-val_count], group[-val_count:]

    train_pos, val_pos = split_group(positives)
    train_neg, val_neg = split_group(negatives)

    train_examples = train_pos + train_neg
    val_examples = val_pos + val_neg
    rng.shuffle(train_examples)
    rng.shuffle(val_examples)

    if train_cap > 0:
        train_examples = train_examples[:train_cap]
    if val_cap > 0:
        val_examples = val_examples[:val_cap]

    if not train_examples or not val_examples:
        raise ValueError("Not enough captures to create train/validation splits")

    return train_examples, val_examples


async def _load_real_datasets(
    *,
    dsn: str,
    train_cap: int,
    val_cap: int,
    seed: int,
    positive_labels: set[str],
    negative_labels: set[str],
) -> tuple[TensorDataset, TensorDataset, dict[str, int]]:
    rows = await _fetch_training_rows(
        dsn,
        positive_labels=positive_labels,
        negative_labels=negative_labels,
        limit=train_cap + val_cap,
    )

    examples: list[tuple[torch.Tensor, torch.Tensor]] = []
    skipped = 0
    label_counts: Counter[str] = Counter()

    for row in rows:
        target = _capture_label_to_target(
            row["capture_label"],
            positive_labels=positive_labels,
            negative_labels=negative_labels,
        )
        if target is None:
            skipped += 1
            continue

        label_counts[_normalize_label(row["capture_label"])] += 1
        examples.append(
            _row_to_example(
                row,
                positive_labels=positive_labels,
                negative_labels=negative_labels,
            )
        )

    examples = [example for example in examples if example is not None]
    if not examples:
        raise RuntimeError(
            "No labeled training captures found. Use capture_label values that map to "
            "positive or negative classes."
        )

    train_examples, val_examples = _stratified_split(
        examples,
        seed=seed,
        train_cap=train_cap,
        val_cap=val_cap,
    )

    train_ds = _stack_examples(train_examples)
    val_ds = _stack_examples(val_examples)
    stats = {
        "total_rows": len(rows),
        "used_rows": len(examples),
        "skipped_rows": skipped,
        "train_examples": len(train_examples),
        "val_examples": len(val_examples),
        "positive_examples": sum(1 for _, label in examples if math.isclose(float(label.item()), 1.0, rel_tol=1e-9, abs_tol=1e-9)),
        "negative_examples": sum(1 for _, label in examples if math.isclose(float(label.item()), 0.0, rel_tol=1e-9, abs_tol=1e-9)),
    }
    stats.update({f"label_{key}": value for key, value in label_counts.items()})
    return train_ds, val_ds, stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Train wave-detection model from real captures")
    parser.add_argument("--db-dsn", type=str, default="", help="Postgres DSN; defaults to backend/.env")
    parser.add_argument("--train-size", type=int, default=TRAINING_CONFIG["train_size"], help="Max labeled captures to use for training")
    parser.add_argument("--val-size", type=int, default=TRAINING_CONFIG["val_size"], help="Max labeled captures to use for validation")
    parser.add_argument("--epochs", type=int, default=TRAINING_CONFIG["epochs"], help="Number of epochs")
    parser.add_argument("--batch", type=int, default=TRAINING_CONFIG["batch_size"], help="Batch size")
    parser.add_argument("--lr", type=float, default=TRAINING_CONFIG["learning_rate"], help="Learning rate")
    parser.add_argument("--dropout", type=float, default=DEFAULT_DROPOUT, help="Dropout rate")
    parser.add_argument("--seed", type=int, default=TRAINING_CONFIG["seed"], help="Random seed")
    parser.add_argument(
        "--positive-labels",
        type=str,
        default=",".join(DEFAULT_POSITIVE_LABELS),
        help="Comma-separated capture_label values treated as positive examples",
    )
    parser.add_argument(
        "--negative-labels",
        type=str,
        default=",".join(DEFAULT_NEGATIVE_LABELS),
        help="Comma-separated capture_label values treated as negative examples",
    )
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    dsn = _resolve_postgres_dsn(args.db_dsn or None)
    positive_labels = _parse_label_set(args.positive_labels)
    negative_labels = _parse_label_set(args.negative_labels)

    print("Loading real captures from Postgres …")
    train_ds, val_ds, stats = asyncio.run(
        _load_real_datasets(
            dsn=dsn,
            train_cap=args.train_size,
            val_cap=args.val_size,
            seed=args.seed,
            positive_labels=positive_labels,
            negative_labels=negative_labels,
        )
    )

    print(
        f"Loaded {stats['used_rows']} labeled captures "
        f"({stats['positive_examples']} positive / {stats['negative_examples']} negative; "
        f"skipped {stats['skipped_rows']})."
    )

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch,
        shuffle=True,
        num_workers=TRAINING_CONFIG["num_workers"],
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch,
        shuffle=False,
        num_workers=TRAINING_CONFIG["num_workers"],
    )

    model = WaveDetector(dropout=args.dropout).to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=TRAINING_CONFIG["weight_decay"])
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode=TRAINING_CONFIG["scheduler"]["mode"],
        factor=TRAINING_CONFIG["scheduler"]["factor"],
        patience=TRAINING_CONFIG["scheduler"]["patience"],
    )

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")

    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    best_val_loss = float("inf")
    best_path = str(get_training_checkpoint_path())

    print(f"\n{'Epoch':>5}  {'Train Loss':>10}  {'Train Acc':>9}  {'Val Loss':>10}  {'Val Acc':>9}  {'Time':>6}")
    print("-" * 60)

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()

        train_loss, train_acc = _run_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = _run_epoch(model, val_loader, criterion, None, device)

        scheduler.step(val_loss)
        elapsed = time.time() - t0

        print(
            f"{epoch:5d}  {train_loss:10.4f}  {train_acc:9.4f}  "
            f"{val_loss:10.4f}  {val_acc:9.4f}  {elapsed:5.1f}s"
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_loss": val_loss,
                    "val_acc": val_acc,
                },
                best_path,
            )
            print(f"        ↳ saved best checkpoint (val_loss={val_loss:.4f})")

    print(f"\nTraining complete.  Best val loss: {best_val_loss:.4f}")
    print(f"Checkpoint saved to: {best_path}")


if __name__ == "__main__":
    main()
