import { createSlice } from "@reduxjs/toolkit";

const tokenFromStorage = localStorage.getItem("klavo_access_token");
const userFromStorage = localStorage.getItem("klavo_user");

const initialState = {
  user: userFromStorage ? JSON.parse(userFromStorage) : null,
  token: tokenFromStorage || null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;

      // persist login
      localStorage.setItem("klavo_access_token", token);
      localStorage.setItem("klavo_user", JSON.stringify(user));
    },

    logout: (state) => {
      state.user = null;
      state.token = null;

      // remove from storage
      localStorage.removeItem("klavo_access_token");
      localStorage.removeItem("klavo_user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
