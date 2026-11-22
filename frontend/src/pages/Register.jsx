import React, { useState } from "react";
import axiosClient from "../api/axiosClient";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { Link, useNavigate } from "react-router-dom";
import OAuthButtons from "../components/OAuthButtons";

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
    <div className="flex justify-center items-center min-h-screen bg-slate-950 text-slate-100 p-4 font-sans">
      <div className="border border-slate-800 rounded-2xl p-8 bg-slate-900/90 shadow-2xl w-full max-w-sm backdrop-blur-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-xl mb-3 shadow-lg shadow-indigo-500/30">
            K
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Create account</h1>
          <p className="text-xs text-slate-400 mt-1">Start collaborating with your team on Klavo</p>
        </div>

        {/* Modern OAuth Login Buttons (Google + GitHub) */}
        <OAuthButtons />

        {hasOAuth && (
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-slate-900 px-3 text-slate-500">Or register with email</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 text-red-300 rounded-xl text-xs text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full name</label>
            <input
              className="border border-slate-700 bg-slate-800/70 p-2.5 w-full rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email address</label>
            <input
              className="border border-slate-700 bg-slate-800/70 p-2.5 w-full rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              className="border border-slate-700 bg-slate-800/70 p-2.5 w-full rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold flex justify-center text-xs transition shadow-md shadow-indigo-600/30 cursor-pointer mt-2"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Register"
            )}
          </button>
        </form>

        <p className="text-center mt-5 text-xs text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-400 font-semibold hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
