import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import axiosClient from "../api/axiosClient";

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error_description") || searchParams.get("error");

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!code) {
      setError("No authorization code received from GitHub.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const { data } = await axiosClient.post("/auth/github", { code });
        dispatch(setCredentials(data));
        navigate("/");
      } catch (err) {
        console.error("GitHub exchange error:", err);
        setError(err.response?.data?.message || "Failed to authenticate with GitHub.");
      }
    };

    exchangeCode();
  }, [searchParams, dispatch, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white px-4">
      <div className="p-8 bg-slate-800/80 border border-slate-700 rounded-2xl max-w-sm w-full text-center shadow-xl">
        {error ? (
          <div>
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center text-xl font-bold mb-4">
              ✕
            </div>
            <h2 className="text-lg font-bold mb-2">GitHub Login Failed</h2>
            <p className="text-xs text-slate-400 mb-6">{error}</p>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div>
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-base font-bold mb-1">Authenticating with GitHub</h2>
            <p className="text-xs text-slate-400">Please wait while we complete your sign in...</p>
          </div>
        )}
      </div>
    </div>
  );
}
