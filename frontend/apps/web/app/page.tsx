"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hazardHeroApi, type ApiDevice } from "../src/lib/apiClient";

const DEVICE_POLL_INTERVAL_MS = 5000;

const statusLabels: Record<string, string> = {
  assistance_requested: "Assistance requested",
  assistance_in_progress: "In progress",
  available: "Available",
  offline: "Offline",
  error: "Error",
  unknown: "Unknown",
};

function formatStatus(status: string | null | undefined) {
  return statusLabels[status ?? ""] ?? (status || "Unknown").replaceAll("_", " ");
}

function formatTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusClass(status: string) {
  if (status === "assistance_requested") return "status status-alert";
  if (status === "assistance_in_progress") return "status status-progress";
  if (status === "available") return "status status-ready";
  if (status === "offline") return "status status-muted";
  return "status status-danger";
}

export default function HomePage() {
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<"online" | "offline" | "checking">("checking");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);
  const previousAttentionIds = useRef<Set<string> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const loadDevices = useCallback(async (background = false) => {
    if (background) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const [health, nextDevices] = await Promise.all([
        hazardHeroApi.health(),
        hazardHeroApi.listDevices(),
      ]);
      setServiceStatus(health.status === "healthy" ? "online" : "offline");
      setDevices(nextDevices);
      setError(null);
    } catch (err) {
      setServiceStatus("offline");
      setError(err instanceof Error ? err.message : "Unable to reach the Hazard Hero service.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();

    const poll = window.setInterval(() => {
      void loadDevices(true);
    }, DEVICE_POLL_INTERVAL_MS);

    return () => window.clearInterval(poll);
  }, [loadDevices]);

  const playAttentionAlert = useCallback(() => {
    const context = audioContext.current;
    if (!soundEnabled || !context) return;

    const now = context.currentTime;
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(660, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.34);
  }, [soundEnabled]);

  const attentionIds = useMemo(
    () => new Set(devices
      .filter((device) => device.operationalStatus === "assistance_requested")
      .map((device) => device.deviceId)),
    [devices],
  );

  useEffect(() => {
    const previousIds = previousAttentionIds.current;
    previousAttentionIds.current = attentionIds;
    if (!previousIds) return;

    const hasNewRequest = [...attentionIds].some((deviceId) => !previousIds.has(deviceId));
    if (hasNewRequest) playAttentionAlert();
  }, [attentionIds, playAttentionAlert]);

  async function toggleSoundAlerts() {
    if (soundEnabled) {
      setSoundEnabled(false);
      return;
    }

    try {
      const context = audioContext.current ?? new AudioContext();
      await context.resume();
      audioContext.current = context;
      setSoundError(null);
      setSoundEnabled(true);
    } catch (err) {
      setSoundError(err instanceof Error ? err.message : "Sound alerts could not be enabled.");
    }
  }

  const metrics = useMemo(() => ({
    total: devices.length,
    attention: devices.filter((device) => device.operationalStatus === "assistance_requested").length,
    active: devices.filter((device) => device.operationalStatus === "assistance_in_progress").length,
    offline: devices.filter((device) => device.connectivityStatus === "offline").length,
  }), [devices]);

  async function runAction(device: ApiDevice, action: "acknowledge" | "resolve") {
    setActionId(device.deviceId);
    try {
      const result = action === "acknowledge"
        ? await hazardHeroApi.acknowledgeDevice(device.deviceId)
        : await hazardHeroApi.resolveDevice(device.deviceId);
      setDevices((current) => current.map((item) =>
        item.deviceId === result.deviceId
          ? { ...item, operationalStatus: result.operationalStatus ?? item.operationalStatus }
          : item,
      ));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The device action could not be completed.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Hazard Hero home">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>Hazard Hero</span>
        </a>
        <div className="service-indicator" aria-live="polite">
          <span className={`service-dot service-${serviceStatus}`} />
          {serviceStatus === "checking" ? "Checking service" : serviceStatus === "online" ? "Service online" : "Service offline"}
        </div>
        <button
          className="sound-toggle"
          onClick={() => void toggleSoundAlerts()}
          aria-pressed={soundEnabled}
          title={soundEnabled ? "Disable sound alerts" : "Enable sound alerts"}
        >
          <span aria-hidden="true">{soundEnabled ? "♪" : "♫"}</span>
          {soundEnabled ? "Sound on" : "Enable sound"}
        </button>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Operations console</p>
          <h1>Keep every sign ready to help.</h1>
          <p className="hero-copy">Monitor connected Hazard Hero signs, respond to assistance requests, and resolve incidents from one calm, focused view.</p>
        </div>
        <button className="button button-secondary" onClick={() => void loadDevices(true)} disabled={isRefreshing}>
          <span aria-hidden="true">{isRefreshing ? "..." : ">"}</span>
          {isRefreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Connection issue.</strong> {error}
          <button onClick={() => void loadDevices()} className="text-button">Try again</button>
        </div>
      )}
      {soundError && (
        <div className="error-banner" role="alert">
          <strong>Sound issue.</strong> {soundError}
        </div>
      )}

      <section className="metric-grid" aria-label="Device summary">
        <article className="metric-card"><span className="metric-label">Total signs</span><strong>{metrics.total}</strong><span className="metric-note">In your network</span></article>
        <article className="metric-card metric-card-alert"><span className="metric-label">Needs attention</span><strong>{metrics.attention}</strong><span className="metric-note">Waiting for response</span></article>
        <article className="metric-card"><span className="metric-label">In progress</span><strong>{metrics.active}</strong><span className="metric-note">Being handled now</span></article>
        <article className="metric-card"><span className="metric-label">Offline</span><strong>{metrics.offline}</strong><span className="metric-note">Check connectivity</span></article>
      </section>

      <section className="panel" aria-labelledby="devices-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Live inventory</p>
            <h2 id="devices-heading">Connected signs</h2>
          </div>
          <span className="count-badge">{devices.length} {devices.length === 1 ? "sign" : "signs"}</span>
        </div>

        {isLoading ? (
          <div className="loading-state" aria-busy="true"><span className="loader" /> Loading your signs...</div>
        ) : devices.length === 0 ? (
          <div className="empty-state"><span className="empty-icon" aria-hidden="true">-</span><h3>No signs found</h3><p>When a sign is registered, it will appear here.</p></div>
        ) : (
          <div className="device-list">
            {devices.map((device) => (
              <article className="device-row" key={device.deviceId}>
                <div className="device-identity"><span className="device-icon" aria-hidden="true">*</span><div><h3>{device.serialNumber || device.deviceId}</h3><p>{device.modelCode || "Hazard Hero sign"} / {device.deviceId}</p></div></div>
                <div className="device-details"><span className={statusClass(device.operationalStatus)}>{formatStatus(device.operationalStatus)}</span><span className="connectivity"><span className={`connectivity-dot ${device.connectivityStatus === "online" ? "online" : ""}`} />{device.connectivityStatus === "online" ? "Online" : "Offline"}</span><span className="battery" title={`${device.batteryPercentage}% battery`}><span className="battery-track"><span style={{ width: `${Math.max(0, Math.min(100, device.batteryPercentage))}%` }} /></span>{device.batteryPercentage}%</span></div>
                <div className="device-meta"><span>Last seen <strong>{formatTime(device.lastSeenAt)}</strong></span><div className="actions">{device.operationalStatus === "assistance_requested" && <button className="button button-primary" onClick={() => void runAction(device, "acknowledge")} disabled={actionId === device.deviceId}>{actionId === device.deviceId ? "Working…" : "Acknowledge"}</button>}{device.operationalStatus === "assistance_in_progress" && <button className="button button-primary" onClick={() => void runAction(device, "resolve")} disabled={actionId === device.deviceId}>{actionId === device.deviceId ? "Working…" : "Resolve"}</button>}</div></div>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer>Hazard Hero <span>/</span> Anonymous service console</footer>
    </main>
  );
}
