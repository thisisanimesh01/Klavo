import React, { useState } from "react";
import axiosClient from "../api/axiosClient";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { Link, useNavigate } from "react-router-dom";
import OAuthButtons from "../components/OAuthButtons";
import { Sparkles, ArrowRight, CheckCircle2, Zap, Layers } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();

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
      const res = await axiosClient.post("/auth/register", {
        name,
        email,
        password,
      });

      dispatch(
        setCredentials({
          user: res.data.user,
          token: res.data.token || res.data.accessToken,
        })
      );
      navigate("/");
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Registration failed");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 sm:p-6 overflow-hidden font-sans">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-4xl grid md:grid-cols-5 rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl overflow-hidden">
        
        {/* Left Side: Product Showcase & Brand Highlight */}
        <div className="hidden md:flex md:col-span-2 flex-col justify-between p-8 bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-slate-950/80 border-r border-slate-800/60">
          <div>
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Get Started in Seconds</span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
                K
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Klavo</span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight leading-snug mb-3">
              Build fast, collaborate seamlessly.
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Join engineering teams creating sprint plans, documents, and workflows in one intelligent workspace.
            </p>

            <div className="mt-8 space-y-3.5">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>Free forever for personal workspaces</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span>Instant team invitations & RBAC</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span>Real-time sync across web and desktop</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>SOC 2 & GDPR compliant standards</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Systems Online</span>
            </div>
          </div>
        </div>

        {/* Right Side: Register Form */}
        <div className="md:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
          <div className="text-center md:text-left mb-6">
            <div className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xl mb-3 shadow-lg shadow-indigo-500/30">
              K
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Create account</h1>
            <p className="text-xs text-slate-400 mt-1">Start collaborating with your team today</p>
          </div>

          {/* Social Sign-In Providers */}
          <OAuthButtons />

          {hasOAuth && (
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800/80" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-slate-900/90 px-3 text-slate-500">Or register with email</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 text-red-300 rounded-xl text-xs text-center">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full name</label>
              <input
                type="text"
                placeholder="Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-800/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Work email</label>
              <input
                type="email"
                placeholder="Email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-800/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-800/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  <span>Register</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-6 text-xs text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline">
              Login
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
