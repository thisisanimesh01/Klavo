import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import axiosClient from "../api/axiosClient";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { useNavigate } from "react-router-dom";

export default function GoogleLoginButton() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleConfigured = Boolean(
    rawClientId &&
      rawClientId.trim() !== "" &&
      !rawClientId.includes("your_google_oauth_client_id")
  );

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data } = await axiosClient.post("/auth/google", {
        credential: credentialResponse.credential,
      });

      dispatch(setCredentials(data));
      navigate("/");
    } catch (error) {
      console.error("Google authentication failed:", error);
      setErrorMsg(error.response?.data?.message || "Google authentication failed. Please use standard email/password login.");
      setLoading(false);
    }
  };

  if (!isGoogleConfigured) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center my-3">
      {loading ? (
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setErrorMsg("Google Sign-In was cancelled or failed.")}
        />
      )}
      {errorMsg && (
        <p className="text-red-500 text-xs mt-2 text-center max-w-xs">{errorMsg}</p>
      )}
    </div>
  );
}
