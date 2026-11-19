import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { setAuthCookie } from "../utils/cookieHelpers.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuthController = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "No credential provided" });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub } = payload;

    let user = await User.findOne({ email });

    if (!user) {
  user = await User.create({
    name,
    email,
    avatar: picture,
    googleUser: true,
    password: undefined, // No password for Google users
  });
}


    const token = generateToken(user._id);
    setAuthCookie(res, token);

    return res.json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        onboarding: user.onboarding,
      },
      token,
    });
  } catch (err) {
    console.error("Google Login Error:", err);
    res.status(500).json({ message: "Google auth failed" });
  }
};
