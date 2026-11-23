import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { useNavigate, Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import OAuthButtons from "../components/OAuthButtons";
import { Sparkles, ArrowRight, ShieldCheck, Zap, Layers } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const rawGoogleId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const rawGithubId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const hasOAuth = Boolean(
    (rawGoogleId && !rawGoogleId.includes("your_google_oauth_client_id")) ||
    (rawGithubId && !rawGithubId.includes("your_github_client_id"))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const { data } = await axiosClient.post("/auth/login", { email, password });
      dispatch(setCredentials(data));

      setTimeout(() => navigate("/"), 400);
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid email or password";
      setErrorMessage(msg);
      setLoading(false);
      // Retain browser alert for existing E2E dialog test assertions
      alert(msg);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 sm:p-6 overflow-hidden font-sans">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-4xl grid md:grid-cols-5 rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl overflow-hidden">
        
        {/* Left Side: Product Showcase & Brand Highlight */}
        <div className="hidden md:flex md:col-span-2 flex-col justify-between p-8 bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-slate-950/80 border-r border-slate-800/60">
          <div>
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Klavo Workspace 2.0</span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
                K
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Klavo</span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight leading-snug mb-3">
              Where high-velocity teams ship together.
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time collaboration, CRDT-backed docs, automated workflows, and enterprise agility in one unified platform.
            </p>

            <div className="mt-8 space-y-3.5">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span>Automated Sprint & Velocity Analytics</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span>CRDT-powered Realtime Collaborative Docs</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span>Enterprise Access Controls & Audit Logging</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Enterprise-ready Cloud</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Systems Online</span>
            </div>
          </div>
        </div>

        {/* Right Side: Sign-In Form */}
        <div className="md:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
          <div className="text-center md:text-left mb-6">
            <div className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xl mb-3 shadow-lg shadow-indigo-500/30">
              K
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to Klavo</h2>
            <p className="text-xs text-slate-400 mt-1">Sign in to your Klavo workspace</p>
          </div>

          {/* Social Sign-In Providers */}
          <OAuthButtons />

          {hasOAuth && (
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800/80" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-slate-900/90 px-3 text-slate-500">Or continue with email</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 text-red-300 rounded-xl text-xs text-center">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                placeholder="Email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-800/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">Password</label>
              </div>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-800/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                required
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-6 text-xs text-slate-400">
            Don't have an account?{" "}
            <Link to="/register" className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline">
              Register
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
