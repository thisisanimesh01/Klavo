import { createSlice } from "@reduxjs/toolkit";

/**
 * Safely parses the stored user object from localStorage.
 * If corrupt, missing, or malformed, gracefully returns null and purges bad keys.
 */
export const getSafeStoredUser = () => {
  try {
    const raw = localStorage.getItem("klavo_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to parse klavo_user from localStorage; resetting session.");
    localStorage.removeItem("klavo_user");
    return null;
  }
};

const tokenFromStorage = localStorage.getItem("klavo_access_token");
const userFromStorage = getSafeStoredUser();

const initialState = {
  user: userFromStorage,
  token: tokenFromStorage || null,
  isAuthenticated: Boolean(tokenFromStorage),
  isLoading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;

      // persist login
      if (token) {
        localStorage.setItem("klavo_access_token", token);
      }
      if (user) {
        localStorage.setItem("klavo_user", JSON.stringify(user));
      }
    },

    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;

      // remove from storage
      localStorage.removeItem("klavo_access_token");
      localStorage.removeItem("klavo_user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
