import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    console.log(`✅ MongoDB connected successfully to: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error("MongoDB connection error :", err.message);
    process.exit(1);
  }
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed cleanly.");
  } catch (err) {
    console.error("Error closing MongoDB connection:", err.message);
  }
};
