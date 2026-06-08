"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Device, Organization } from "@hazard-hero/shared";
import { sharedApi } from "../src/lib/apiClient";
import { clearTokens, getRefreshToken } from "../src/lib/tokens";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth`;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await sharedApi.authAPI.getCurrentUser();
      setIsAuthenticated(true);
      const [orgs, allDevices] = await Promise.all([
        sharedApi.organizationAPI.getOrganizations(),
        sharedApi.devicesAPI.list(),
      ]);
      setOrganizations(orgs);
      setDevices(allDevices);
      setError(null);
    } catch (err) {
      setIsAuthenticated(false);
      setOrganizations([]);
      setDevices([]);
      const msg = err instanceof Error ? err.message : "Failed to load web dashboard.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    getRefreshToken().then(async (refresh) => {
      if (!refresh) {
        setIsLoading(false);
        return;
      }
      await loadData();
    });
  }, [loadData]);

  const beginLogin = async () => {
    const response = await sharedApi.authAPI.initiateLogin(redirectUri);
    window.location.href = response.authorizationUrl;
  };

  const logout = async () => {
    try {
      const response = await sharedApi.authAPI.initiateLogout();
      await clearTokens();
      window.location.href = response.logoutUrl;
    } catch {
      await clearTokens();
      window.location.reload();
    }
  };

  if (isLoading) {
    return (
      <main>
        <h1>Hazard Hero</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main>
        <h1>Hazard Hero Web</h1>
        <p>Sign in to manage organizations and devices.</p>
        <button onClick={beginLogin}>Sign in with WorkOS</button>
        {error && <p>{error}</p>}
      </main>
    );
  }

  return (
    <main>
      <h1>Hazard Hero Web</h1>
      <p>Organizations: {organizations.length}</p>
      <p>Devices: {devices.length}</p>
      <button onClick={loadData}>Refresh</button>{" "}
      <button onClick={logout}>Log out</button>

      <h2>Organizations</h2>
      <ul>
        {organizations.map((org) => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>

      <h2>Devices</h2>
      <ul>
        {devices.map((device) => (
          <li key={device.id}>
            {device.serial_number} - {device.lifecycle_status}
          </li>
        ))}
      </ul>
    </main>
  );
}
