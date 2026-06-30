"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SeedButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSeed() {
    setLoading(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      setDone(true);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <Button variant="secondary" onClick={handleSeed} disabled={loading}>
      {loading ? "Loading demo..." : "Load demo data"}
    </Button>
  );
}
