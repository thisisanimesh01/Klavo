import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import GoogleLoginButton from "../components/GoogleLoginButton";

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleConfigured = Boolean(
    rawClientId &&
      rawClientId.trim() !== "" &&
      !rawClientId.includes("your_google_oauth_client_id")
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const { data } = await axiosClient.post("/auth/login", { email, password });
      dispatch(setCredentials(data));

      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="border rounded-xl p-8 bg-white shadow w-[400px]">
        <h2 className="text-3xl font-bold mb-6 text-center">Welcome to Klavo</h2>

        {/* 🔎 GOOGLE LOGIN BUTTON (Only renders when Google Client ID is configured) */}
        {isGoogleConfigured && (
          <>
            <GoogleLoginButton />
            <div className="text-center my-4 text-xs font-semibold text-gray-400">OR</div>
          </>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="border p-3 w-full rounded mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="border p-3 w-full rounded mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            required
          />

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded font-semibold flex justify-center text-sm transition"
          >
            {loading ? (
              <div className="h-6 w-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-gray-600">
          Don't have an account?{" "}
          <a href="/register" className="text-blue-600 font-medium hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
