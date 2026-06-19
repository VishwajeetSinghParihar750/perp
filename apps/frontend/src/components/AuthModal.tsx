import React, { useState } from "react";
import { useTrading } from "../context/TradingContext";
import { X, User, Lock, ArrowRight, Sparkles } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "signup";
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = "signin" }) => {
  const { login, signUp, error, setError } = useTrading();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (mode === "signin") {
      const success = await login(username, password);
      if (success) {
        onClose();
      }
    } else {
      const res = await signUp(username, password);
      if (res.success) {
        setSuccessMsg(res.message);
        setMode("signin");
        setPassword("");
      } else {
        setError(res.message);
      }
    }
    setLoading(false);
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Try to sign up demo user first (just in case they don't exist yet)
    await signUp("demo_user", "password123");

    // Login with demo credentials
    const success = await login("demo_user", "password123");
    if (success) {
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-[#0F1115] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden text-gray-100">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-bold tracking-tight">
            {mode === "signin" ? "Sign In to Trade" : "Create Account"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-950/40 border border-green-900/60 rounded-xl text-green-400 text-sm">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. trader1"
                  className="w-full bg-[#161920] border border-gray-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#161920] border border-gray-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl py-3 text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {mode === "signin" ? "Sign In" : "Sign Up"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Mode Toggle */}
          <div className="mt-4 text-center text-sm text-gray-500">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline transition-colors"
            >
              {mode === "signin" ? "Sign Up" : "Sign In"}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0F1115] px-3 text-gray-500">Or use instant login</span>
            </div>
          </div>

          {/* Quick Demo Login */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-[#1A1E26] hover:bg-[#232934] border border-emerald-500/20 text-emerald-400 font-semibold rounded-xl py-3 text-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            One-Click Demo Account
          </button>
        </div>
      </div>
    </div>
  );
};
