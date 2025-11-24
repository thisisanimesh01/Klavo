// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import GoogleLoginButton from "../components/GoogleLoginButton";

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const backendURL = "http://localhost:5050/api/auth/login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await axios.post(backendURL, { email, password });
      dispatch(setCredentials(data));

      setTimeout(() => {
        navigate("/");
      }, 800);
    } catch (err) {
      alert("Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="border rounded-xl p-8 bg-white shadow w-[400px]">
        <h2 className="text-3xl font-bold mb-6 text-center">Welcome to Klavo</h2>

        <GoogleLoginButton />

        <div className="text-center my-4">OR</div>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="border p-3 w-full rounded mb-3"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
          />

          <input
            type="password"
            placeholder="Password"
            className="border p-3 w-full rounded mb-3"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded font-semibold flex justify-center"
          >
            {loading ? (
              <div className="h-6 w-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          Don't have an account?{" "}
          <a href="/register" className="text-blue-600 font-medium">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
