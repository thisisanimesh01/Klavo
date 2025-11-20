// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import axiosClient from "../api/axiosClient";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post("/auth/login", { email, password });
      dispatch(
        setCredentials({
          user: res.data.user,
          token: res.data.accessToken,
        })
      );
      navigate("/");
    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen app-bg flex items-center justify-center">
      <div className="app-card p-6 rounded-xl w-full max-w-md shadow">
        <h1 className="text-2xl font-bold mb-4 text-center">Klavo Login</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border px-3 py-2 rounded bg-transparent"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full border px-3 py-2 rounded bg-transparent"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="w-full bg-indigo-600 text-white py-2 rounded">
            Login
          </button>
        </form>
        <p className="text-sm text-center mt-3">
          No account?{" "}
          <Link to="/register" className="text-indigo-600">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
