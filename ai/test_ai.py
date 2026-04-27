"""
Tests for the wave-detection AI module.

Covers:
  - model.py   : WaveDetector architecture, forward pass shapes, output range
  - data.py    : Dataset generation, signal shapes, label balance, normalisation, reproducibility
  - infer.py   : WaveClassifier loading, classify() output, input validation
  - train.py   : _accuracy helper, _run_epoch integration
"""

from __future__ import annotations

import os
import sys
import tempfile

import numpy as np
import pytest
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

# Ensure the ai/ directory is importable
sys.path.insert(0, os.path.dirname(__file__))

from model import WaveDetector
from data import (
    WaveDetectionDataset,
    MAX_VAL,
    _random_sine,
    _random_square,
    _random_noise,
    _random_silence,
)
from train import _accuracy, _run_epoch
from infer import WaveClassifier, SEQ_LEN


# ═══════════════════════════════════════════════════════════════════════════
# model.py — WaveDetector
# ═══════════════════════════════════════════════════════════════════════════


class TestWaveDetector:
    """Unit tests for the WaveDetector CNN."""

    def test_instantiation_defaults(self):
        model = WaveDetector()
        assert isinstance(model, nn.Module)

    def test_instantiation_custom_dropout(self):
        model = WaveDetector(dropout=0.5)
        assert isinstance(model, nn.Module)

    @pytest.mark.parametrize("batch_size", [1, 4, 16, 64])
    def test_forward_output_shape(self, batch_size: int):
        model = WaveDetector()
        model.eval()
        x = torch.randn(batch_size, 1, 512)
        out = model(x)
        assert out.shape == (batch_size, 1)

    def test_output_range_zero_to_one(self):
        """Sigmoid output must be in [0, 1]."""
        model = WaveDetector()
        model.eval()
        x = torch.randn(32, 1, 512)
        with torch.no_grad():
            out = model(x)
        assert (out >= 0).all() and (out <= 1).all()

    def test_deterministic_eval(self):
        """Same input produces same output in eval mode."""
        model = WaveDetector()
        model.eval()
        x = torch.randn(4, 1, 512)
        with torch.no_grad():
            out1 = model(x)
            out2 = model(x)
        assert torch.allclose(out1, out2)

    def test_parameter_count_reasonable(self):
        """Model should be lightweight — fewer than 500k parameters."""
        model = WaveDetector()
        total = sum(p.numel() for p in model.parameters())
        assert total < 500_000

    def test_gradient_flow(self):
        """Gradients should flow through the model during training."""
        model = WaveDetector()
        model.train()
        x = torch.randn(4, 1, 512)
        target = torch.tensor([[1.0], [0.0], [1.0], [0.0]])
        out = model(x)
        loss = nn.BCELoss()(out, target)
        loss.backward()

        has_grad = all(p.grad is not None and p.grad.abs().sum() > 0
                       for p in model.parameters() if p.requires_grad)
        assert has_grad


# ═══════════════════════════════════════════════════════════════════════════
# data.py — signal generators
# ═══════════════════════════════════════════════════════════════════════════


class TestSignalGenerators:
    """Tests for the individual signal generator functions."""

    @pytest.fixture
    def rng(self):
        return np.random.default_rng(42)

    def test_sine_shape_and_range(self, rng):
        sig = _random_sine(512, rng)
        assert sig.shape == (512,)
        assert sig.min() >= 0 and sig.max() <= MAX_VAL

    def test_square_shape_and_range(self, rng):
        sig = _random_square(512, rng)
        assert sig.shape == (512,)
        assert sig.min() >= 0 and sig.max() <= MAX_VAL

    def test_noise_shape_and_range(self, rng):
        sig = _random_noise(512, rng)
        assert sig.shape == (512,)
        assert sig.min() >= 0 and sig.max() <= MAX_VAL

    def test_silence_shape_and_range(self, rng):
        sig = _random_silence(512, rng)
        assert sig.shape == (512,)
        assert sig.min() >= 0 and sig.max() <= MAX_VAL

    def test_sine_is_periodic(self, rng):
        """Sine should have noticeable variance (not flat)."""
        sig = _random_sine(512, rng)
        assert np.std(sig) > 100  # non-trivial variation

    def test_silence_is_nearly_flat(self, rng):
        """Silence should have very low variance relative to range."""
        sig = _random_silence(512, rng)
        relative_std = np.std(sig) / MAX_VAL
        assert relative_std < 0.05


# ═══════════════════════════════════════════════════════════════════════════
# data.py — WaveDetectionDataset
# ═══════════════════════════════════════════════════════════════════════════


class TestWaveDetectionDataset:
    """Tests for the synthetic dataset."""

    def test_length(self):
        ds = WaveDetectionDataset(size=100, seed=0)
        assert len(ds) == 100

    def test_item_shapes(self):
        ds = WaveDetectionDataset(size=20, seed=0)
        x, y = ds[0]
        assert x.shape == (1, 512)
        assert y.shape == ()

    def test_item_types(self):
        ds = WaveDetectionDataset(size=20, seed=0)
        x, y = ds[0]
        assert x.dtype == torch.float32
        assert y.dtype == torch.float32

    def test_signal_normalised(self):
        """All signal values should be in [0, 1] after normalisation."""
        ds = WaveDetectionDataset(size=200, seed=0)
        for i in range(len(ds)):
            x, _ = ds[i]
            assert x.min() >= 0.0 and x.max() <= 1.0

    def test_label_balance(self):
        """Labels should be roughly balanced (50/50 wave vs non-wave)."""
        ds = WaveDetectionDataset(size=400, seed=0)
        labels = [ds[i][1].item() for i in range(len(ds))]
        positive = sum(1 for l in labels if l == 1.0)
        negative = sum(1 for l in labels if l == 0.0)
        assert positive == 200
        assert negative == 200

    def test_seed_reproducibility(self):
        """Same seed should produce identical datasets."""
        ds1 = WaveDetectionDataset(size=50, seed=123)
        ds2 = WaveDetectionDataset(size=50, seed=123)
        for i in range(50):
            x1, y1 = ds1[i]
            x2, y2 = ds2[i]
            assert torch.equal(x1, x2)
            assert y1 == y2

    def test_different_seeds_differ(self):
        """Different seeds should produce different datasets."""
        ds1 = WaveDetectionDataset(size=50, seed=1)
        ds2 = WaveDetectionDataset(size=50, seed=2)
        x1, _ = ds1[0]
        x2, _ = ds2[0]
        assert not torch.equal(x1, x2)

    def test_custom_seq_len(self):
        ds = WaveDetectionDataset(size=10, seq_len=256, seed=0)
        x, _ = ds[0]
        assert x.shape == (1, 256)

    def test_works_with_dataloader(self):
        ds = WaveDetectionDataset(size=32, seed=0)
        loader = DataLoader(ds, batch_size=8, shuffle=False)
        batch_x, batch_y = next(iter(loader))
        assert batch_x.shape == (8, 1, 512)
        assert batch_y.shape == (8,)


# ═══════════════════════════════════════════════════════════════════════════
# train.py — helpers
# ═══════════════════════════════════════════════════════════════════════════


class TestTrainHelpers:
    """Tests for training utility functions."""

    def test_accuracy_perfect(self):
        preds = torch.tensor([0.9, 0.8, 0.1, 0.05])
        targets = torch.tensor([1.0, 1.0, 0.0, 0.0])
        assert _accuracy(preds, targets) == 1.0

    def test_accuracy_all_wrong(self):
        preds = torch.tensor([0.1, 0.2, 0.9, 0.95])
        targets = torch.tensor([1.0, 1.0, 0.0, 0.0])
        assert _accuracy(preds, targets) == 0.0

    def test_accuracy_half(self):
        preds = torch.tensor([0.9, 0.1, 0.9, 0.1])
        targets = torch.tensor([1.0, 1.0, 0.0, 0.0])
        assert _accuracy(preds, targets) == pytest.approx(0.5)

    def test_accuracy_custom_threshold(self):
        preds = torch.tensor([0.6, 0.4])
        targets = torch.tensor([1.0, 0.0])
        assert _accuracy(preds, targets, threshold=0.7) == pytest.approx(0.5)
        assert _accuracy(preds, targets, threshold=0.5) == 1.0


class TestRunEpoch:
    """Integration test for _run_epoch with a tiny model and dataset."""

    @pytest.fixture
    def setup(self):
        device = torch.device("cpu")
        model = WaveDetector(dropout=0.0).to(device)
        ds = WaveDetectionDataset(size=32, seed=0)
        loader = DataLoader(ds, batch_size=8)
        criterion = nn.BCELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
        return model, loader, criterion, optimizer, device

    def test_train_epoch_returns_loss_and_acc(self, setup):
        model, loader, criterion, optimizer, device = setup
        loss, acc = _run_epoch(model, loader, criterion, optimizer, device)
        assert isinstance(loss, float)
        assert isinstance(acc, float)
        assert loss >= 0
        assert 0.0 <= acc <= 1.0

    def test_eval_epoch_returns_loss_and_acc(self, setup):
        model, loader, criterion, _, device = setup
        loss, acc = _run_epoch(model, loader, criterion, None, device)
        assert isinstance(loss, float)
        assert isinstance(acc, float)
        assert loss >= 0
        assert 0.0 <= acc <= 1.0

    def test_training_reduces_loss(self, setup):
        """A few training epochs should reduce loss on the training set."""
        model, loader, criterion, optimizer, device = setup
        loss_first, _ = _run_epoch(model, loader, criterion, optimizer, device)
        for _ in range(5):
            _run_epoch(model, loader, criterion, optimizer, device)
        loss_later, _ = _run_epoch(model, loader, criterion, optimizer, device)
        assert loss_later < loss_first


# ═══════════════════════════════════════════════════════════════════════════
# infer.py — WaveClassifier
# ═══════════════════════════════════════════════════════════════════════════


class TestWaveClassifier:
    """Tests for the inference wrapper."""

    @pytest.fixture
    def checkpoint_path(self, tmp_path):
        """Create a fresh checkpoint from a randomly-initialised model."""
        model = WaveDetector()
        path = str(tmp_path / "test_model.pt")
        torch.save(
            {
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": {},
                "val_loss": 0.5,
                "val_acc": 0.5,
                "epoch": 1,
            },
            path,
        )
        return path

    def test_load_checkpoint(self, checkpoint_path):
        clf = WaveClassifier(checkpoint_path=checkpoint_path, device="cpu")
        assert clf.model is not None

    def test_classify_output_format(self, checkpoint_path):
        clf = WaveClassifier(checkpoint_path=checkpoint_path, device="cpu")
        signal = [32768] * SEQ_LEN  # flat mid-range signal
        result = clf.classify(signal)
        assert "label" in result
        assert "confidence" in result
        assert result["label"] in ("wave", "non-wave")
        assert 0.0 <= result["confidence"] <= 1.0

    def test_classify_numpy_input(self, checkpoint_path):
        clf = WaveClassifier(checkpoint_path=checkpoint_path, device="cpu")
        signal = np.full(SEQ_LEN, 32768, dtype=np.int32)
        result = clf.classify(signal)
        assert result["label"] in ("wave", "non-wave")

    def test_classify_wrong_length_raises(self, checkpoint_path):
        clf = WaveClassifier(checkpoint_path=checkpoint_path, device="cpu")
        with pytest.raises(ValueError, match="Expected 512 samples"):
            clf.classify([100] * 256)

    def test_classify_out_of_range_raises(self, checkpoint_path):
        clf = WaveClassifier(checkpoint_path=checkpoint_path, device="cpu")
        signal = [-1] + [0] * (SEQ_LEN - 1)
        with pytest.raises(ValueError, match="Values must be in"):
            clf.classify(signal)

    def test_classify_above_max_raises(self, checkpoint_path):
        clf = WaveClassifier(checkpoint_path=checkpoint_path, device="cpu")
        signal = [MAX_VAL + 1] + [0] * (SEQ_LEN - 1)
        with pytest.raises(ValueError, match="Values must be in"):
            clf.classify(signal)

    def test_threshold_parameter(self, checkpoint_path):
        clf = WaveClassifier(checkpoint_path=checkpoint_path, device="cpu")
        signal = [32768] * SEQ_LEN
        result_low = clf.classify(signal, threshold=0.01)
        result_high = clf.classify(signal, threshold=0.99)
        # With threshold=0.01 most outputs become "wave"; with 0.99 most become "non-wave"
        assert result_low["confidence"] == result_high["confidence"]


# ═══════════════════════════════════════════════════════════════════════════
# infer.py — end-to-end with trained checkpoint (if available)
# ═══════════════════════════════════════════════════════════════════════════


TRAINED_CHECKPOINT = os.path.join(os.path.dirname(__file__), "checkpoints", "best.pt")


@pytest.mark.skipif(not os.path.exists(TRAINED_CHECKPOINT), reason="No trained checkpoint available")
class TestTrainedModel:
    """End-to-end tests using the actual trained checkpoint."""

    @pytest.fixture(scope="class")
    def clf(self):
        return WaveClassifier(checkpoint_path=TRAINED_CHECKPOINT, device="cpu")

    def test_classifies_sine_as_wave(self, clf):
        """A clean sine wave should be classified as wave with high confidence."""
        t = np.arange(512, dtype=np.float64)
        signal = (32768 + 16000 * np.sin(2 * np.pi * 8 * t / 512)).astype(int)
        signal = np.clip(signal, 0, MAX_VAL)
        result = clf.classify(signal.tolist())
        assert result["label"] == "wave"
        assert result["confidence"] > 0.8

    def test_classifies_square_as_wave(self, clf):
        """A clean square wave should be classified as wave."""
        t = np.arange(512, dtype=np.float64)
        signal = (32768 + 16000 * np.sign(np.sin(2 * np.pi * 5 * t / 512))).astype(int)
        signal = np.clip(signal, 0, MAX_VAL)
        result = clf.classify(signal.tolist())
        assert result["label"] == "wave"
        assert result["confidence"] > 0.8

    def test_classifies_noise_as_non_wave(self, clf):
        """Random noise should be classified as non-wave."""
        rng = np.random.default_rng(99)
        signal = rng.integers(0, MAX_VAL, size=512).tolist()
        result = clf.classify(signal)
        assert result["label"] == "non-wave"
        assert result["confidence"] < 0.3

    def test_classifies_silence_as_non_wave(self, clf):
        """A flat/silent signal should be classified as non-wave."""
        signal = [32768] * 512
        result = clf.classify(signal)
        assert result["label"] == "non-wave"
        assert result["confidence"] < 0.3
