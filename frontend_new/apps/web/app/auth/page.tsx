"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sharedApi } from "../../src/lib/apiClient";
import { setTokens } from "../../src/lib/tokens";

export default function AuthPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const code = useMemo(() => search.get("code"), [search]);

  useEffect(() => {
    if (!code) {
      setError("Missing OAuth code.");
      return;
    }

    sharedApi.authAPI
      .handleCallback(code)
      .then(async (response) => {
        await setTokens(response.accessToken, response.refreshToken);
        router.replace("/");
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "OAuth exchange failed";
        setError(msg);
      });
  }, [code, router]);

  return (
    <main>
      <h1>Hazard Hero</h1>
      <p>{error ?? "Signing you in..."}</p>
    </main>
  );
}
