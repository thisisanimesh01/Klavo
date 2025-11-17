import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosClient from "../../api/axiosClient";

const initialState = {
  user: JSON.parse(localStorage.getItem("klavo_user")) || null,
  token: localStorage.getItem("klavo_access_token") || null,
  loading: false,
  error: null,
};

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await axiosClient.post("/auth/register", payload);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await axiosClient.post("/auth/login", payload);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem("klavo_user");
      localStorage.removeItem("klavo_access_token");
    },
    setCredentials(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem("klavo_user", JSON.stringify(action.payload.user));
      localStorage.setItem("klavo_access_token", action.payload.token);
    },
  },
  extraReducers: (builder) => {
    builder
      // register
      .addCase(registerUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(registerUser.fulfilled, (s) => { s.loading = false; })
      .addCase(registerUser.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message; })
      // login
      .addCase(loginUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(loginUser.fulfilled, (s, a) => {
        s.loading = false;
        const { accessToken, user } = a.payload;
        s.user = user;
        s.token = accessToken;
        localStorage.setItem("klavo_user", JSON.stringify(user));
        localStorage.setItem("klavo_access_token", accessToken);
      })
      .addCase(loginUser.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message; });
  },
});

export const { logout, setCredentials } = authSlice.actions;
export default authSlice.reducer;
