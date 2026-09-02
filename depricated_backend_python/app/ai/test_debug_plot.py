from __future__ import annotations

from types import ModuleType, SimpleNamespace
from unittest.mock import patch

from app.ai import debug_plot
from app.ai.config import SIGNAL_CONFIG

SAMPLE_COUNT = SIGNAL_CONFIG["sample_count"]


class _FakeLine:
    def __init__(self):
        self.data = None

    def set_data(self, x_values, y_values):
        self.data = (list(x_values), list(y_values))


class _FakeAxes:
    def __init__(self):
        self.title = None
        self.xlim = None
        self.ylim = None
        self.line = _FakeLine()

    def plot(self, x_values, y_values, linewidth):
        self.line.set_data(x_values, y_values)
        return (self.line,)

    def set_xlabel(self, _value):
        return None

    def set_ylabel(self, _value):
        return None

    def grid(self, *_args, **_kwargs):
        return None

    def set_xlim(self, left, right):
        self.xlim = (left, right)

    def set_ylim(self, bottom, top):
        self.ylim = (bottom, top)

    def set_title(self, value):
        self.title = value


class _FakeFigure:
    def __init__(self, number):
        self.number = number
        self.canvas = SimpleNamespace(draw_idle=lambda: None, flush_events=lambda: None)
        self.tight_layout_called = False

    def tight_layout(self):
        self.tight_layout_called = True


class _FakePyplot:
    def __init__(self):
        self.closed = []
        self.pause_calls = []
        self.subplots_calls = 0
        self.last_axes = None
        self._next_number = 1
        self._open_numbers = set()

    def ion(self):
        return None

    def fignum_exists(self, number):
        return number in self._open_numbers

    def close(self, figure):
        self.closed.append(figure.number)
        self._open_numbers.discard(figure.number)

    def subplots(self, num):
        self.subplots_calls += 1
        figure = _FakeFigure(self._next_number)
        axes = _FakeAxes()
        self.last_axes = axes
        self._next_number += 1
        self._open_numbers.add(figure.number)
        return figure, axes

    def show(self, block):
        return None

    def pause(self, interval):
        self.pause_calls.append(interval)
        return None


class _FakeDispatcher:
    def __init__(self):
        self.payloads = []

    def send(self, payload):
        self.payloads.append(payload)


def test_render_signal_debug_plot_enqueues_payload_for_background_dispatch():
    payloads = []

    with patch("app.ai.debug_plot._enqueue_plot_request", side_effect=payloads.append):
        debug_plot.render_signal_debug_plot(
            [123] * SAMPLE_COUNT,
            serial_number="serial-1",
            label="wave",
            confidence=0.8123,
        )

    assert len(payloads) == 1
    payload = payloads[0]
    assert payload.signal == [123] * SAMPLE_COUNT
    assert payload.serial_number == "serial-1"
    assert payload.label == "wave"
    assert payload.confidence == 0.8123


def test_dispatch_plot_requests_forwards_payload_to_plot_process():
    dispatcher = _FakeDispatcher()
    request_queue = _FakeRequestQueue([
        debug_plot.DebugPlotPayload(
            signal=[111] * SAMPLE_COUNT,
            serial_number="serial-1",
            label="wave",
            confidence=0.7123,
        ),
        None,
    ])

    with patch("app.ai.debug_plot._get_plot_dispatcher", return_value=dispatcher):
        debug_plot._dispatch_plot_requests(request_queue)

    assert len(dispatcher.payloads) == 1
    payload = dispatcher.payloads[0]
    assert payload.signal == [111] * SAMPLE_COUNT
    assert payload.serial_number == "serial-1"
    assert payload.label == "wave"
    assert payload.confidence == 0.7123


def test_render_signal_debug_plot_now_closes_window_after_display_timeout():
    pyplot = _FakePyplot()
    matplotlib = ModuleType("matplotlib")
    matplotlib.pyplot = pyplot

    with patch.dict(
        "sys.modules",
        {
            "matplotlib": matplotlib,
            "matplotlib.pyplot": pyplot,
        },
    ):
        debug_plot._figure = None
        debug_plot._axes = None
        debug_plot._line = None

        debug_plot._render_signal_debug_plot_now(
            debug_plot.DebugPlotPayload(
                signal=[100] * SAMPLE_COUNT,
                serial_number="serial-1",
                label="non-wave",
                confidence=0.3000,
            )
        )

        assert pyplot.pause_calls == [2.5]
        assert pyplot.closed == [1]
        assert pyplot.subplots_calls == 1
        assert pyplot.last_axes.title == "Live inference samples: serial-1 | non-wave (0.3000)"
        assert debug_plot._figure is None
        assert debug_plot._axes is None
        assert debug_plot._line is None


class _FakeRequestQueue:
    def __init__(self, items):
        self.items = list(items)

    def get(self):
        return self.items.pop(0)
