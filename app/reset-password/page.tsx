"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const accessToken = searchParams.get("access_token");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!accessToken) {
      setError("Invalid or missing token.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password reset successful! You can now log in.");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-calm-cream px-4">
      <div className="w-full max-w-md">
        <div className="calm-card">
          <h1 className="text-2xl font-light text-calm-text mb-4">Reset Password</h1>
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-calm-text mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="calm-input"
                minLength={6}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-calm-text mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="calm-input"
                minLength={6}
                disabled={loading}
              />
            </div>
            {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-lg bg-calm-sage p-4 text-sm text-green-800">{success}</div>}
            <button
              type="submit"
              disabled={loading}
              className="calm-button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
