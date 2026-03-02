"""
Status-driven LED patterns for pin 2.

Uses a hardware timer so patterns run in the background without
blocking the main sampling loop.

Patterns by sign_status:
  available             – slow heartbeat  (1 s on, 2 s off)
  assistance_requested  – fast blink      (200 ms on/off)
  assistance_in_progress– double flash    (2 quick blinks, 1 s pause)
  offline               – LED off
  error                 – triple rapid burst then pause (SOS-like)
  training_ready        – medium pulse    (500 ms on/off)
  training_positive     – solid on
  training_negative     – very fast blink (100 ms on/off)
"""

import machine
import time


# ── Pattern definitions ──────────────────────────────────────────────
# Each pattern is a tuple of (on_ms, off_ms) pairs that repeat.
# A single pair means a simple on/off cycle.
# Multiple pairs create more complex rhythms.

PATTERNS = {
    "available": (
        (1000, 2000),
    ),
    "assistance_requested": (
        (200, 200),
    ),
    "assistance_in_progress": (
        (150, 150),
        (150, 800),
    ),
    "offline": (
        (0, 1000),
    ),
    "error": (
        (100, 100),
        (100, 100),
        (100, 800),
    ),
    "training_ready": (
        (500, 500),
    ),
    "training_positive": (
        (1000, 0),
    ),
    "training_negative": (
        (100, 100),
    ),
}


class StatusLED:
    """Non-blocking LED driver that flashes a pattern based on sign status."""

    def __init__(self, pin: int = 2, timer_id: int = 0):
        self.pin = machine.Pin(pin, machine.Pin.OUT)
        self.pin.off()

        self._timer = machine.Timer(timer_id)
        self._pattern = PATTERNS["offline"]
        self._step = 0        # which (on, off) pair we're in
        self._phase = 0       # 0 = on phase,  1 = off phase
        self._running = False

    # ── public API ────────────────────────────────────────────────────

    def set_status(self, status: str):
        """Switch to the pattern for *status*.  Unknown statuses → offline."""
        pattern = PATTERNS.get(status, PATTERNS["offline"])
        if pattern == self._pattern and self._running:
            return  # already showing this pattern
        self._pattern = pattern
        self._step = 0
        self._phase = 0
        self._start()

    def off(self):
        """Turn LED off and stop the timer."""
        self._timer.deinit()
        self.pin.off()
        self._running = False

    # ── internals ─────────────────────────────────────────────────────

    def _start(self):
        """Kick off the pattern from step 0, on-phase."""
        self._timer.deinit()
        self._running = True
        self._tick(None)  # execute first transition immediately

    def _tick(self, _timer):
        """Timer callback — toggle the LED and schedule the next edge."""
        on_ms, off_ms = self._pattern[self._step]

        if self._phase == 0:
            # ── ON phase ──
            if on_ms > 0:
                self.pin.on()
            else:
                self.pin.off()
            next_delay = on_ms if on_ms > 0 else off_ms
            self._phase = 1
        else:
            # ── OFF phase ──
            self.pin.off()
            # advance to next step (wrap around)
            self._step = (self._step + 1) % len(self._pattern)
            next_delay = off_ms
            self._phase = 0

        if next_delay <= 0:
            # edge case: solid-on pattern → just stay on, re-check in 1 s
            next_delay = 1000

        self._timer.init(
            mode=machine.Timer.ONE_SHOT,
            period=next_delay,
            callback=self._tick,
        )
