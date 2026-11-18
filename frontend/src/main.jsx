import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

import { Provider } from "react-redux";
import store from "./store/store";

import { ThemeProvider } from "./context/ThemeContext";
import { LiveRegionProvider } from "./context/LiveRegionContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId={clientId}>
    <Provider store={store}>
      <ThemeProvider>
        <LiveRegionProvider>
          <App />
        </LiveRegionProvider>
      </ThemeProvider>
    </Provider>
  </GoogleOAuthProvider>
);
