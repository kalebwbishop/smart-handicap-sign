"use client";

import { useEffect } from "react";

export default function AuthPage() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return (
    <main className="app-shell">
      <div className="loading-state" aria-busy="true">
        Returning to the operations console...
      </div>
    </main>
  );
}
