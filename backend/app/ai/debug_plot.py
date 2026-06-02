from __future__ import annotations

import atexit
from dataclasses import dataclass
from multiprocessing import Process, Queue
from queue import Empty, Full, Queue as ThreadQueue
from threading import Lock, Thread
from typing import Any, Sequence

import numpy as np

from app.ai.config import SIGNAL_CONFIG
from app.utils.logger import logger

MAX_ADC_VALUE = SIGNAL_CONFIG["max_value"]
DEBUG_PLOT_DISPLAY_SECONDS = 2.5

_plot_lock = Lock()
_dispatcher_lock = Lock()
_request_thread_lock = Lock()
_dispatcher = None
_dispatcher_shutdown_registered = False
_request_queue = None
_request_thread = None
_figure = None
_axes = None
_line = None


@dataclass
class DebugPlotPayload:
    signal: list[int]
    serial_number: str | None = None
    label: str | None = None
    confidence: float | None = None


class PlotDispatcher:
    def __init__(
        self,
        *,
        process_factory: Any = Process,
        queue_factory: Any = Queue,
    ) -> None:
        self._queue = queue_factory(maxsize=1)
        self._process = process_factory(
            target=_plot_worker,
            args=(self._queue,),
            daemon=True,
        )
        self._process.start()

    def send(self, payload: DebugPlotPayload) -> None:
        _replace_latest_payload(self._queue, payload)

    def close(self) -> None:
        if not self.is_alive():
            return

        try:
            _replace_latest_payload(self._queue, None)
        except Exception:
            logger.debug("Failed to send plot shutdown signal", exc_info=True)

        self._process.join(timeout=1)
        if self._process.is_alive():
            self._process.terminate()
            self._process.join(timeout=1)

    def is_alive(self) -> bool:
        return self._process.is_alive()


def render_signal_debug_plot(
    signal: Sequence[int],
    *,
    serial_number: str | None = None,
    label: str | None = None,
    confidence: float | None = None,
) -> None:
    _enqueue_plot_request(
        DebugPlotPayload(
            signal=list(signal),
            serial_number=serial_number,
            label=label,
            confidence=confidence,
        )
    )


def _get_plot_dispatcher() -> PlotDispatcher:
    global _dispatcher, _dispatcher_shutdown_registered

    with _dispatcher_lock:
        if _dispatcher is None or not _dispatcher.is_alive():
            _dispatcher = PlotDispatcher()

        if not _dispatcher_shutdown_registered:
            atexit.register(_shutdown_plot_dispatcher)
            _dispatcher_shutdown_registered = True

        return _dispatcher


def _get_request_queue() -> ThreadQueue:
    global _request_queue

    with _request_thread_lock:
        if _request_queue is None:
            _request_queue = ThreadQueue(maxsize=1)
        return _request_queue


def _ensure_plot_dispatcher_thread() -> None:
    global _request_thread

    queue = _get_request_queue()

    with _request_thread_lock:
        if _request_thread is None or not _request_thread.is_alive():
            _request_thread = Thread(
                target=_dispatch_plot_requests,
                args=(queue,),
                daemon=True,
                name="inference-debug-plot-dispatcher",
            )
            _request_thread.start()


def _enqueue_plot_request(payload: DebugPlotPayload) -> None:
    queue = _get_request_queue()
    _ensure_plot_dispatcher_thread()
    _replace_latest_payload(queue, payload)


def _dispatch_plot_requests(request_queue: ThreadQueue) -> None:
    while True:
        payload = request_queue.get()
        if payload is None:
            return

        try:
            dispatcher = _get_plot_dispatcher()
            dispatcher.send(payload)
        except Exception:
            logger.exception("Failed to dispatch inference debug plot")


def _shutdown_plot_dispatcher() -> None:
    global _dispatcher, _request_queue, _request_thread

    request_queue = _request_queue
    request_thread = _request_thread
    if request_queue is not None:
        try:
            _replace_latest_payload(request_queue, None)
        except Exception:
            logger.debug("Failed to send plot dispatcher shutdown signal", exc_info=True)

    if request_thread is not None:
        request_thread.join(timeout=1)

    with _request_thread_lock:
        _request_thread = None
        _request_queue = None

    with _dispatcher_lock:
        if _dispatcher is not None:
            _dispatcher.close()
            _dispatcher = None


def _replace_latest_payload(plot_queue: Any, payload: DebugPlotPayload | None) -> None:
    while True:
        try:
            plot_queue.put_nowait(payload)
            return
        except Full:
            try:
                plot_queue.get_nowait()
            except Empty:
                continue


def _plot_worker(plot_queue: Any) -> None:
    while True:
        payload = plot_queue.get()
        if payload is None:
            return

        try:
            _render_signal_debug_plot_now(payload)
        except Exception:
            logger.exception("Failed to render inference debug plot")


def _render_signal_debug_plot_now(payload: DebugPlotPayload) -> None:
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        logger.warning(
            "Inference debug plotting is enabled, but matplotlib is not installed."
        )
        return

    global _figure, _axes, _line

    arr = np.asarray(payload.signal, dtype=np.int32)
    sample_indexes = np.arange(arr.size)

    with _plot_lock:
        plt.ion()

        if _figure is not None and plt.fignum_exists(_figure.number):
            plt.close(_figure)

        _figure, _axes = plt.subplots(num="Hazard Hero Inference Debug")
        (_line,) = _axes.plot(sample_indexes, arr, linewidth=1.5)
        _axes.set_xlabel("Sample")
        _axes.set_ylabel("ADC reading")
        _axes.grid(True, alpha=0.3)

        y_min = max(0, int(arr.min()) - 50) if arr.size else 0
        y_max = min(MAX_ADC_VALUE, int(arr.max()) + 50) if arr.size else MAX_ADC_VALUE
        if y_min >= y_max:
            y_max = min(MAX_ADC_VALUE, y_min + 1)

        _axes.set_xlim(0, max(1, arr.size - 1))
        _axes.set_ylim(y_min, y_max)
        _axes.set_title(_build_plot_title(payload))
        _figure.tight_layout()
        _figure.canvas.draw_idle()
        _figure.canvas.flush_events()
        plt.show(block=False)
        plt.pause(DEBUG_PLOT_DISPLAY_SECONDS)
        plt.close(_figure)
        _figure = None
        _axes = None
        _line = None


def _build_plot_title(payload: DebugPlotPayload) -> str:
    title = f"Live inference samples: {payload.serial_number or 'unknown device'}"
    if payload.label is not None and payload.confidence is not None:
        return f"{title} | {payload.label} ({payload.confidence:.4f})"
    if payload.confidence is not None:
        return f"{title} | score {payload.confidence:.4f}"
    return title
