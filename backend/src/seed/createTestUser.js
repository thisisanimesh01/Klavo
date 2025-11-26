// backend/src/seed/createTestUser.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB for seeding");

    const email = "animesh@gmail.com";
    const password = "Klavo12345";

    // check if user exists
    let user = await User.findOne({ email });

    if (user) {
      console.log("ℹ️ User already exists:", email);
    } else {
      user = await User.create({
        name: "Animesh",
        email,
        password,   // plain for now, must match login logic
        googleUser: false,
      });
      console.log("✅ Created test user:", user.email);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding user:", err);
    process.exit(1);
  }
};

run();
