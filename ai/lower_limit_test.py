"""Measure the model's range floor using real labeled wave captures.

This script loads labeled training captures from Postgres, computes each
capture's actual ADC range, and runs the recorded waveform through the trained
wave classifier.
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
import json
import os
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from config import INFERENCE_CONFIG, SIGNAL_CONFIG, get_training_checkpoint_path
from infer import WaveClassifier

SEQ_LEN = SIGNAL_CONFIG["sample_count"]
MAX_VAL = SIGNAL_CONFIG["max_value"]
DEFAULT_THRESHOLD = INFERENCE_CONFIG["threshold"]
DEFAULT_CHECKPOINT = str(get_training_checkpoint_path())
DEFAULT_POSITIVE_LABELS = ("wave", "positive", "training_positive")
DEFAULT_NEGATIVE_LABELS = ("non-wave", "negative", "training_negative")
BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / "backend" / ".env"


@dataclass(frozen=True)
class SweepResult:
	capture_id: str
	device_serial_number: str
	signal_range: int
	range_fraction: float
	peak_amplitude: float
	label: str
	confidence: float


def _normalize_label(label: str) -> str:
	return label.strip().lower()


def _parse_label_set(raw: str) -> set[str]:
	return {_normalize_label(label) for label in raw.split(",") if label.strip()}


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
		values[key.strip()] = value.strip().strip('"').strip("'")
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


def _coerce_samples(raw_samples: Any) -> list[int]:
	if isinstance(raw_samples, str):
		raw_samples = json.loads(raw_samples)
	if not isinstance(raw_samples, Iterable):
		raise ValueError("samples must be an array of integers")
	return [int(value) for value in raw_samples]


async def _fetch_real_captures(
	dsn: str,
	positive_labels: set[str],
	negative_labels: set[str],
	limit: int | None,
) -> list[dict[str, Any]]:
	import asyncpg

	conn = await asyncpg.connect(dsn=dsn)
	try:
		query = """
			SELECT id, device_serial_number, capture_label, sample_count, samples, created_at
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


def run_sweep(
	classifier: WaveClassifier,
	captures: list[dict[str, Any]],
	threshold: float,
) -> list[SweepResult]:
	results: list[SweepResult] = []
	for capture in captures:
		signal = _coerce_samples(capture["samples"])
		actual_range = max(signal) - min(signal)
		classification = classifier.classify(signal, threshold=threshold)
		results.append(
			SweepResult(
				capture_id=str(capture["id"]),
				device_serial_number=str(capture["device_serial_number"]),
				signal_range=actual_range,
				range_fraction=actual_range / MAX_VAL,
				peak_amplitude=actual_range / 2,
				label=str(classification["label"]),
				confidence=float(classification["confidence"]),
			)
		)
	return results


def print_results(results: list[SweepResult], threshold: float) -> None:
	print(f"Decision threshold: {threshold:.4f}")
	print("capture_id,device_serial_number,signal_range_adc,range_fraction,peak_amplitude_adc,label,confidence")
	for result in results:
		print(
			f"{result.capture_id},"
			f"{result.device_serial_number},"
			f"{result.signal_range},"
			f"{result.range_fraction:.6f},"
			f"{result.peak_amplitude:.1f},"
			f"{result.label},"
			f"{result.confidence:.4f}"
		)

	detected = [result for result in results if result.label == "wave"]
	missed = [result for result in results if result.label != "wave"]

	if detected:
		lower_limit = min(detected, key=lambda result: result.signal_range)
		safe_ignore_below = lower_limit.signal_range
		print(
			"\nLowest detected real wave capture: "
			f"range={lower_limit.signal_range} ADC "
			f"({lower_limit.range_fraction:.2%}), "
			f"peak_amplitude={lower_limit.peak_amplitude:.1f} ADC, "
			f"confidence={lower_limit.confidence:.4f}"
		)
		print(f"Can safely ignore samples with a range less than: {safe_ignore_below} ADC")
	else:
		print("\nNo real capture was classified as a wave.")

	if missed:
		first_miss = missed[0]
		print(
			"First miss among real captures: "
			f"range={first_miss.signal_range} ADC "
			f"({first_miss.range_fraction:.2%}), "
			f"label={first_miss.label}, "
			f"confidence={first_miss.confidence:.4f}"
		)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Find the smallest real wave-capture range detected by the trained model."
	)
	parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT, help="Path to model checkpoint")
	parser.add_argument("--db-dsn", default="", help="Postgres DSN; defaults to backend/.env")
	parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help="Wave threshold")
	parser.add_argument(
		"--positive-labels",
		default=",".join(DEFAULT_POSITIVE_LABELS),
		help="Comma-separated capture_label values treated as positive examples",
	)
	parser.add_argument(
		"--negative-labels",
		default=",".join(DEFAULT_NEGATIVE_LABELS),
		help="Comma-separated capture_label values treated as negative examples",
	)
	parser.add_argument("--limit", type=int, default=0, help="Maximum number of captures to evaluate (0 = all)")
	return parser.parse_args()


def main() -> None:
	args = parse_args()

	dsn = _resolve_postgres_dsn(args.db_dsn or None)
	positive_labels = _parse_label_set(args.positive_labels)
	negative_labels = _parse_label_set(args.negative_labels)
	limit = None if args.limit <= 0 else args.limit
	captures = asyncio.run(_fetch_real_captures(dsn, positive_labels, negative_labels, limit))
	if not captures:
		raise RuntimeError("No matching real captures found")

	print(f"Loaded {len(captures)} real captures")
	classifier = WaveClassifier(checkpoint_path=args.checkpoint)
	results = run_sweep(classifier=classifier, captures=captures, threshold=args.threshold)
	print_results(results, threshold=args.threshold)


if __name__ == "__main__":
	main()
