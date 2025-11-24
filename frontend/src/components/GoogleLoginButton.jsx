// frontend/src/components/GoogleLoginButton.jsx
import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { useNavigate } from "react-router-dom";

export default function GoogleLoginButton() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const { data } = await axios.post("http://localhost:5050/api/auth/google", {
        credential: credentialResponse.credential,
      });

      dispatch(setCredentials(data));
      navigate("/");
    } catch (error) {
      console.error(error);
      alert("Google login failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center my-3">
      {loading ? (
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <GoogleLogin onSuccess={handleSuccess} onError={() => alert("Google login failed")} />
      )}
    </div>
  );
}
