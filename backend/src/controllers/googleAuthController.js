import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { setAuthCookie } from "../utils/cookieHelpers.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuthController = async (req, res) => {
  try {
    const { credential, profile } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "No credential or token provided" });
    }

    let email = null;
    let name = null;
    let picture = "";

    // 1. If client provided direct verified Google userinfo profile
    if (profile && profile.email) {
      email = profile.email;
      name = profile.name || profile.given_name || "Google User";
      picture = profile.picture || "";
    } else {
      // 2. Otherwise verify JWT ID token using OAuth2Client
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (idTokenErr) {
        // 3. Fallback: verify via Google userinfo endpoint if credential is an access token using native fetch
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${credential}` },
        });
        const userInfoData = await userInfoRes.json();
        email = userInfoData.email;
        name = userInfoData.name;
        picture = userInfoData.picture;
      }
    }

    if (!email) {
      return res.status(400).json({ message: "Unable to retrieve verified email from Google" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        avatar: picture,
        googleUser: true,
        password: undefined,
      });
    } else {
      let needsSave = false;
      if (!user.avatar && picture) {
        user.avatar = picture;
        needsSave = true;
      }
      if (!user.googleUser) {
        user.googleUser = true;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
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
    console.error("Google Login Error:", err.message);
    res.status(500).json({ message: "Google auth failed", error: err.message });
  }
};
