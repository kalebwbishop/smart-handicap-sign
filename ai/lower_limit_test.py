"""Sweep perfect sine waves downward to find the model's range floor.

This script generates clean, centered sine waves with progressively smaller
signal ranges and runs each one through the trained wave classifier.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass

import numpy as np

from config import INFERENCE_CONFIG, SIGNAL_CONFIG, get_training_checkpoint_path
from infer import WaveClassifier

SEQ_LEN = SIGNAL_CONFIG["sample_count"]
MAX_VAL = SIGNAL_CONFIG["max_value"]
DEFAULT_THRESHOLD = INFERENCE_CONFIG["threshold"]
DEFAULT_CHECKPOINT = str(get_training_checkpoint_path())


@dataclass(frozen=True)
class SweepResult:
	signal_range: int
	range_fraction: float
	peak_amplitude: float
	label: str
	confidence: float


def perfect_sine(
	signal_range: int,
	cycles: float,
	dc_offset: float,
	phase: float,
	seq_len: int = SEQ_LEN,
) -> list[int]:
	t = np.arange(seq_len, dtype=np.float64)
	wave = np.sin((2 * np.pi * cycles * t / seq_len) + phase)
	wave_span = wave.max() - wave.min()
	if wave_span == 0:
		raise ValueError("Generated wave has no range; choose a different --cycles value")

	centered_wave = ((wave - wave.min()) / wave_span) - 0.5
	signal = dc_offset + (signal_range * centered_wave)
	return np.clip(np.rint(signal), 0, MAX_VAL).astype(int).tolist()


def run_sweep(
	classifier: WaveClassifier,
	signal_ranges: np.ndarray,
	cycles: float,
	dc_offset: float,
	phase: float,
	threshold: float,
) -> list[SweepResult]:
	results: list[SweepResult] = []
	for signal_range in signal_ranges:
		rounded_range = int(round(float(signal_range)))
		signal = perfect_sine(
			signal_range=rounded_range,
			cycles=cycles,
			dc_offset=dc_offset,
			phase=phase,
		)
		actual_range = max(signal) - min(signal)
		classification = classifier.classify(signal, threshold=threshold)
		results.append(
			SweepResult(
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
	print("signal_range_adc,range_fraction,peak_amplitude_adc,label,confidence")
	for result in results:
		print(
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
		print(
			"\nLowest detected perfect wave: "
			f"range={lower_limit.signal_range} ADC "
			f"({lower_limit.range_fraction:.2%}), "
			f"peak_amplitude={lower_limit.peak_amplitude:.1f} ADC, "
			f"confidence={lower_limit.confidence:.4f}"
		)
	else:
		print("\nNo generated amplitude was classified as a wave.")

	if missed:
		first_miss = missed[0]
		print(
			"First miss while sweeping downward: "
			f"range={first_miss.signal_range} ADC "
			f"({first_miss.range_fraction:.2%}), "
			f"confidence={first_miss.confidence:.4f}"
		)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Find the smallest clean sine-wave range detected by the trained model."
	)
	parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT, help="Path to model checkpoint")
	parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help="Wave threshold")
	parser.add_argument("--cycles", type=float, default=4.0, help="Number of sine cycles in the sample window")
	parser.add_argument("--phase", type=float, default=0.0, help="Sine phase in radians")
	parser.add_argument(
		"--dc-offset",
		type=float,
		default=MAX_VAL / 2,
		help="Signal center value in ADC counts; defaults to mid-scale",
	)
	parser.add_argument(
		"--max-range",
		type=int,
		default=MAX_VAL,
		help="Starting max-min signal range in ADC counts",
	)
	parser.add_argument("--min-range", type=int, default=1, help="Ending max-min signal range in ADC counts")
	parser.add_argument("--steps", type=int, default=32, help="Number of signal ranges to test")
	return parser.parse_args()


def main() -> None:
	args = parse_args()
	if args.steps < 2:
		raise ValueError("--steps must be at least 2")
	if args.min_range < 0:
		raise ValueError("--min-range must be non-negative")
	if args.max_range <= args.min_range:
		raise ValueError("--max-range must be greater than --min-range")
	if args.dc_offset - (args.max_range / 2) < 0 or args.dc_offset + (args.max_range / 2) > MAX_VAL:
		raise ValueError("--dc-offset and --max-range would clip the generated wave")

	classifier = WaveClassifier(checkpoint_path=args.checkpoint)
	signal_ranges = np.linspace(args.max_range, args.min_range, args.steps)
	results = run_sweep(
		classifier=classifier,
		signal_ranges=signal_ranges,
		cycles=args.cycles,
		dc_offset=args.dc_offset,
		phase=args.phase,
		threshold=args.threshold,
	)
	print_results(results, threshold=args.threshold)


if __name__ == "__main__":
	main()
