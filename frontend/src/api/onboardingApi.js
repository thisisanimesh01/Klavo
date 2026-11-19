import axiosClient from "./axiosClient";

/**
 * Onboarding API client for UX-08
 */
export const getOnboardingState = async () => {
  const res = await axiosClient.get("/users/onboarding");
  return res.data;
};

export const updateOnboardingState = async (updates) => {
  const res = await axiosClient.put("/users/onboarding", updates);
  return res.data;
};

export const resetOnboardingState = async () => {
  const res = await axiosClient.put("/users/onboarding", { reset: true });
  return res.data;
};
