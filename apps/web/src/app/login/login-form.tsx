"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      if (response.status === 429 || payload?.code === "rate_limited") {
        setError("Too many login attempts — wait a minute and try again.");
      } else {
        setError(payload?.error ?? "Invalid password");
      }
      setLoading(false);
      return;
    }

    router.push(searchParams.get("next") ?? "/markets");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <CardTitle className="mb-1">PolyAgent OSS</CardTitle>
          <CardDescription>Enter dashboard password to continue.</CardDescription>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </Card>
  );
}
