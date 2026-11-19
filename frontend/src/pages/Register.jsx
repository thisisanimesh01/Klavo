import React, { useState } from "react";
import axiosClient from "../api/axiosClient";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      alert(err.response?.data?.message || "Register failed");
    }
  };

  return (
    <div className="min-h-screen app-bg flex items-center justify-center">
      <div className="app-card p-6 rounded-xl w-full max-w-md shadow">
        <h1 className="text-2xl font-bold mb-4 text-center">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border px-3 py-2 rounded bg-transparent"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
            Register
          </button>
        </form>
        <p className="text-sm text-center mt-3">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
