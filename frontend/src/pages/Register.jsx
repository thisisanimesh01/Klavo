import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { registerUser } from "../store/slices/authSlice";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(registerUser(form));
    if (res.type === "auth/registerUser/fulfilled") {
      // After register, navigate to login
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-6">Create an account</h2>

        <label className="block mb-3">
          <span className="text-sm">Name</span>
          <input required type="text" className="mt-1 w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        </label>

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
          {loading ? "Creating..." : "Register"}
        </button>

        <div className="mt-4 text-sm">
          Already have an account? <Link to="/login" className="text-indigo-600">Login</Link>
        </div>
      </form>
    </div>
  );
}
