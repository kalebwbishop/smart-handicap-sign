"""
Training script for the wave-detection model.

Usage
-----
    python train.py                         # defaults: 50 k train, 10 k val, 20 epochs
    python train.py --epochs 40 --batch 128 # override hyper-parameters
"""

from __future__ import annotations

import argparse
import os
import time

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from data import WaveDetectionDataset
from model import WaveDetector

CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")


# ── helpers ──────────────────────────────────────────────────────────────────


def _accuracy(preds: torch.Tensor, targets: torch.Tensor, threshold: float = 0.5) -> float:
    predicted = (preds >= threshold).float()
    return (predicted == targets).float().mean().item()


def _run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer | None,
    device: torch.device,
) -> tuple[float, float]:
    """Run one training or validation epoch.  Pass optimizer=None for eval."""
    is_train = optimizer is not None
    model.train() if is_train else model.eval()

    total_loss = 0.0
    total_acc = 0.0
    n_batches = 0

    ctx = torch.no_grad() if not is_train else torch.enable_grad()
    with ctx:
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            out = model(x).squeeze(-1)          # (batch,)
            loss = criterion(out, y)

            if is_train:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            total_loss += loss.item()
            total_acc += _accuracy(out, y)
            n_batches += 1

    return total_loss / n_batches, total_acc / n_batches


# ── main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Train wave-detection model")
    parser.add_argument("--train-size",  type=int,   default=50_000, help="Training set size")
    parser.add_argument("--val-size",    type=int,   default=10_000, help="Validation set size")
    parser.add_argument("--epochs",      type=int,   default=20,     help="Number of epochs")
    parser.add_argument("--batch",       type=int,   default=64,     help="Batch size")
    parser.add_argument("--lr",          type=float, default=1e-3,   help="Learning rate")
    parser.add_argument("--dropout",     type=float, default=0.3,    help="Dropout rate")
    parser.add_argument("--seed",        type=int,   default=42,     help="Random seed")
    args = parser.parse_args()

    # ── device ───────────────────────────────────────────────────────────
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # ── data ─────────────────────────────────────────────────────────────
    print("Generating synthetic datasets …")
    train_ds = WaveDetectionDataset(size=args.train_size, seed=args.seed)
    val_ds   = WaveDetectionDataset(size=args.val_size,   seed=args.seed + 1)

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch, shuffle=False, num_workers=0)

    # ── model / loss / optimiser ─────────────────────────────────────────
    model = WaveDetector(dropout=args.dropout).to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=3,
    )

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")

    # ── training loop ────────────────────────────────────────────────────
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    best_val_loss = float("inf")
    best_path = os.path.join(CHECKPOINT_DIR, "best.pt")

    print(f"\n{'Epoch':>5}  {'Train Loss':>10}  {'Train Acc':>9}  {'Val Loss':>10}  {'Val Acc':>9}  {'Time':>6}")
    print("-" * 60)

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()

        train_loss, train_acc = _run_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc     = _run_epoch(model, val_loader,   criterion, None,      device)

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
