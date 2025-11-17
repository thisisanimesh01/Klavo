import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/slices/authSlice";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Klavo</h1>
          <div className="flex items-center gap-4">
            <div>{user?.name}</div>
            <button onClick={() => dispatch(logout())} className="px-3 py-1 border rounded">
              Logout
            </button>
          </div>
        </header>

        <main>
          <Link
  to="/projects"
  className="block bg-white p-6 rounded-xl shadow hover:shadow-md transition text-xl font-medium"
>
  View Projects →
</Link>

<Link
  to="/teams"
  className="block bg-white p-6 rounded-xl shadow hover:shadow-md transition text-xl font-medium mt-6"
>
  Manage Teams →
</Link>

        </main>
      </div>
    </div>
  );
}

