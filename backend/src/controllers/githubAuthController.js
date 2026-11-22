import { User } from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { setAuthCookie } from "../utils/cookieHelpers.js";

/**
 * Handles GitHub OAuth code exchange and user login/registration.
 * Uses native fetch (Node.js 18+) so no external HTTP dependencies are required.
 */
export const githubAuthController = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Authorization code is required" });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: "GitHub OAuth is not configured on the server" });
    }

    // 1. Exchange code for GitHub access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    const { access_token, error, error_description } = tokenData;

    if (error || !access_token) {
      console.error("GitHub token exchange error:", error, error_description);
      return res.status(401).json({ message: error_description || "Failed to exchange GitHub authorization code" });
    }

    // 2. Fetch authenticated GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "Klavo-App",
      },
    });

    const githubUser = await userRes.json();
    let email = githubUser.email;

    // 3. If primary email is private in profile, fetch from emails endpoint
    if (!email) {
      try {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "User-Agent": "Klavo-App",
          },
        });
        const emailsData = await emailsRes.json();
        const primaryEmailObj = emailsData?.find((e) => e.primary && e.verified) || emailsData?.[0];
        if (primaryEmailObj) {
          email = primaryEmailObj.email;
        }
      } catch (emailErr) {
        console.warn("Could not fetch user emails from GitHub:", emailErr.message);
      }
    }

    if (!email) {
      email = `${githubUser.login}@users.noreply.github.com`;
    }

    const name = githubUser.name || githubUser.login || "GitHub User";
    const avatar = githubUser.avatar_url || "";

    // 4. Find or create user in MongoDB
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        avatar,
        githubUser: true,
        password: undefined,
      });
    } else {
      let needsSave = false;
      if (!user.avatar && avatar) {
        user.avatar = avatar;
        needsSave = true;
      }
      if (!user.githubUser) {
        user.githubUser = true;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    // 5. Generate application JWT token and cookie
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
    console.error("GitHub Auth Error:", err.message);
    return res.status(500).json({ message: "GitHub authentication failed", error: err.message });
  }
};
