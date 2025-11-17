import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../store/slices/authSlice";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ email: "", password: "" });

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(loginUser(form));
    if (res.type === "auth/loginUser/fulfilled") {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-6">Klavo — Login</h2>

        <label className="block mb-3">
          <span className="text-sm">Email</span>
          <input required type="email" className="mt-1 w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
        </label>

        <label className="block mb-4">
          <span className="text-sm">Password</span>
          <input required type="password" className="mt-1 w-full border rounded px-3 py-2" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
        </label>

        {error && <div className="text-red-600 mb-3">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="mt-4 text-sm">
          No account? <Link to="/register" className="text-indigo-600">Register</Link>
        </div>
      </form>
    </div>
  );
}

