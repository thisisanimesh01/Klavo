import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  User,
  Building,
  Shield,
  Palette,
  Users,
  Camera,
  Search,
  Check,
  AlertCircle,
  Trash2,
  UserPlus,
  ArrowRightLeft,
  KeyRound,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  Avatar,
  Badge,
  Modal,
  LoadingState,
  EmptyState,
} from "../components/ui";
import { useTheme } from "../context/ThemeContext";
import { setCredentials } from "../store/slices/authSlice";
import {
  getMyProfile,
  updateMyProfile,
  uploadUserAvatar,
  changeAccountPassword,
  getMyWorkspaces,
  updateWorkspace,
  uploadWorkspaceLogo,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateMemberRole,
  transferWorkspaceOwnership,
  deleteWorkspace,
} from "../api/settingsApi";

export default function Settings() {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth?.user);
  const { theme, toggleTheme } = useTheme();

  // Active settings tab: 'profile' | 'account' | 'preferences' | 'workspace' | 'directory'
  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form State
  const [name, setName] = useState(authUser?.name || "");
  const [bio, setBio] = useState(authUser?.bio || "");
  const [roleTitle, setRoleTitle] = useState(authUser?.roleTitle || "");
  const [avatarPreview, setAvatarPreview] = useState(authUser?.avatar || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Account / Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Workspaces State
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceSuccess, setWorkspaceSuccess] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");

  // Workspace Form State
  const [wsName, setWsName] = useState("");
  const [wsDescription, setWsDescription] = useState("");
  const [wsLogo, setWsLogo] = useState("");

  // Ownership Transfer State (UX-06)
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  // Delete Workspace State (UX-06)
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  // Member Directory State
  const [directorySearch, setDirectorySearch] = useState("");
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("member");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [memberActionError, setMemberActionError] = useState("");
  const [profilePreviewUser, setProfilePreviewUser] = useState(null);

  // Load User Profile on Mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getMyProfile();
        if (data) {
          setName(data.name || "");
          setBio(data.bio || "");
          setRoleTitle(data.roleTitle || "");
          setAvatarPreview(data.avatar || "");
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    };
    loadProfile();
  }, []);

  // Load Workspaces
  useEffect(() => {
    const loadWorkspaces = async () => {
      setWorkspaceLoading(true);
      try {
        const data = await getMyWorkspaces();
        setWorkspaces(data || []);
        if (data && data.length > 0 && !selectedWorkspaceId) {
          setSelectedWorkspaceId(data[0]._id);
        }
      } catch (err) {
        console.error("Failed to load workspaces:", err);
      } finally {
        setWorkspaceLoading(false);
      }
    };
    loadWorkspaces();
  }, [selectedWorkspaceId]);

  // Synchronize selected workspace form & resolved permissions
  const activeWorkspace = workspaces.find((w) => w._id === selectedWorkspaceId) || null;
  const isWorkspaceOwner =
    activeWorkspace?.owner?._id === authUser?._id || activeWorkspace?.owner === authUser?._id;

  // Resolve current user's role in active workspace
  const getCurrentUserRole = () => {
    if (!activeWorkspace || !authUser) return "member";
    if (isWorkspaceOwner) return "owner";
    const roleEntry = (activeWorkspace.memberRoles || []).find(
      (mr) => (mr.userId?._id || mr.userId)?.toString() === authUser._id.toString()
    );
    return roleEntry?.role || "member";
  };

  const currentUserRole = getCurrentUserRole();
  const isWorkspaceAdmin = currentUserRole === "admin" || isWorkspaceOwner;
  const isGuest = currentUserRole === "guest";

  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name || "");
      setWsDescription(activeWorkspace.description || "");
      setWsLogo(activeWorkspace.logo || "");
      setWorkspaceError("");
      setWorkspaceSuccess("");
      setMemberActionError("");
    }
  }, [selectedWorkspaceId, workspaces]);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess("");
    setProfileError("");

    try {
      const updated = await updateMyProfile({ name, bio, roleTitle });
      dispatch(
        setCredentials({
          user: { ...authUser, ...updated },
          token: localStorage.getItem("klavo_access_token"),
        })
      );
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Avatar File Upload
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await uploadUserAvatar(formData);
      setAvatarPreview(res.avatar);
      if (res.user) {
        dispatch(
          setCredentials({
            user: { ...authUser, ...res.user },
            token: localStorage.getItem("klavo_access_token"),
          })
        );
      }
      setProfileSuccess("Avatar uploaded successfully!");
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || "Failed to upload avatar");
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordSuccess("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      setPasswordSaving(false);
      return;
    }

    try {
      await changeAccountPassword({ currentPassword, newPassword });
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 4000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  // Handle Workspace Settings Update
  const handleSaveWorkspace = async (e) => {
    e.preventDefault();
    if (!selectedWorkspaceId) return;

    setWorkspaceSaving(true);
    setWorkspaceSuccess("");
    setWorkspaceError("");

    try {
      const updated = await updateWorkspace(selectedWorkspaceId, {
        name: wsName,
        description: wsDescription,
      });

      setWorkspaces((prev) =>
        prev.map((w) => (w._id === updated._id ? { ...w, ...updated } : w))
      );
      setWorkspaceSuccess("Workspace settings updated successfully!");
      setTimeout(() => setWorkspaceSuccess(""), 4000);
    } catch (err) {
      setWorkspaceError(err.response?.data?.message || "Failed to update workspace");
    } finally {
      setWorkspaceSaving(false);
    }
  };

  // Handle Workspace Logo Upload
  const handleWorkspaceLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWorkspaceId) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await uploadWorkspaceLogo(selectedWorkspaceId, formData);
      setWsLogo(res.logo);
      setWorkspaces((prev) =>
        prev.map((w) => (w._id === selectedWorkspaceId ? { ...w, logo: res.logo } : w))
      );
      setWorkspaceSuccess("Workspace logo updated successfully!");
      setTimeout(() => setWorkspaceSuccess(""), 4000);
    } catch (err) {
      setWorkspaceError(err.response?.data?.message || "Failed to upload logo");
    }
  };

  // Handle Ownership Transfer (UX-06)
  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!selectedWorkspaceId || !selectedNewOwnerId) return;

    setTransferring(true);
    setTransferError("");

    try {
      const res = await transferWorkspaceOwnership(selectedWorkspaceId, selectedNewOwnerId);
      setWorkspaces((prev) =>
        prev.map((w) => (w._id === res.team._id ? res.team : w))
      );
      setTransferModalOpen(false);
      setWorkspaceSuccess("Workspace ownership transferred successfully!");
      setTimeout(() => setWorkspaceSuccess(""), 4000);
    } catch (err) {
      setTransferError(err.response?.data?.message || "Failed to transfer ownership");
    } finally {
      setTransferring(false);
    }
  };

  // Handle Workspace Deletion (UX-06)
  const handleDeleteWorkspace = async () => {
    if (deleteConfirmName !== activeWorkspace?.name) {
      return;
    }

    setDeletingWorkspace(true);
    try {
      await deleteWorkspace(selectedWorkspaceId);
      const remaining = workspaces.filter((w) => w._id !== selectedWorkspaceId);
      setWorkspaces(remaining);
      setSelectedWorkspaceId(remaining.length > 0 ? remaining[0]._id : "");
      setDeleteModalOpen(false);
      setDeleteConfirmName("");
    } catch (err) {
      setWorkspaceError(err.response?.data?.message || "Failed to delete workspace");
    } finally {
      setDeletingWorkspace(false);
    }
  };

  // Handle Member Role Update (UX-06)
  const handleRoleChange = async (memberId, newRole) => {
    setMemberActionError("");
    try {
      const updated = await updateMemberRole(selectedWorkspaceId, memberId, newRole);
      setWorkspaces((prev) =>
        prev.map((w) => (w._id === updated._id ? updated : w))
      );
    } catch (err) {
      setMemberActionError(err.response?.data?.message || "Failed to update member role");
    }
  };

  // Handle Add Member to Workspace
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addMemberEmail || !selectedWorkspaceId) return;

    setAddMemberLoading(true);
    setMemberActionError("");

    try {
      const updated = await addWorkspaceMember(
        selectedWorkspaceId,
        addMemberEmail,
        addMemberRole
      );
      setWorkspaces((prev) =>
        prev.map((w) => (w._id === updated._id ? updated : w))
      );
      setAddMemberEmail("");
      setAddMemberRole("member");
    } catch (err) {
      setMemberActionError(err.response?.data?.message || "Failed to add member");
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Handle Remove Member from Workspace
  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Are you sure you want to remove this member from the workspace?")) {
      return;
    }
    setMemberActionError("");

    try {
      const updated = await removeWorkspaceMember(selectedWorkspaceId, memberId);
      setWorkspaces((prev) =>
        prev.map((w) => (w._id === updated._id ? updated : w))
      );
    } catch (err) {
      setMemberActionError(err.response?.data?.message || "Failed to remove member");
    }
  };

  // Helper to resolve any member's role in the active workspace
  const getMemberRole = (memberId) => {
    if (!activeWorkspace) return "member";
    const isOwner =
      activeWorkspace.owner?._id?.toString() === memberId.toString() ||
      activeWorkspace.owner?.toString() === memberId.toString();
    if (isOwner) return "owner";

    const entry = (activeWorkspace.memberRoles || []).find(
      (mr) => (mr.userId?._id || mr.userId)?.toString() === memberId.toString()
    );
    return entry?.role || "member";
  };

  // Filter Directory Members
  const directoryMembers = (activeWorkspace?.members || []).filter((m) => {
    if (!directorySearch.trim()) return true;
    const term = directorySearch.toLowerCase();
    const role = getMemberRole(m._id);
    return (
      m.name?.toLowerCase().includes(term) ||
      m.email?.toLowerCase().includes(term) ||
      m.roleTitle?.toLowerCase().includes(term) ||
      role.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings & Workspace
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal profile, security credentials, workspace configuration, and access controls.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-sm font-medium gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === "profile"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <User size={16} />
          Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === "account"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Shield size={16} />
          Account & Security
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === "preferences"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Palette size={16} />
          Preferences
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("workspace")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === "workspace"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Building size={16} />
          Workspace Settings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === "directory"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Users size={16} />
          Members & Roles
        </button>
      </div>

      {/* TAB 1: Profile */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Avatar & Card Preview */}
          <Card className="p-6 flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <Avatar
                src={avatarPreview}
                name={name || authUser?.name}
                size="xl"
                className="w-24 h-24 text-2xl shadow-lg border-2 border-indigo-500/20"
              />
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs cursor-pointer transition"
                title="Change Avatar"
              >
                <Camera size={20} className="mb-1" />
                <span>Change</span>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
              {name || "Your Name"}
            </h3>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">
              {roleTitle || "Team Member"}
            </p>
            <p className="text-xs text-slate-400 mb-3">{authUser?.email}</p>

            {bio ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs italic">
                "{bio}"
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No bio written yet.</p>
            )}
          </Card>

          {/* Edit Form */}
          <Card className="md:col-span-2 p-6">
            <CardHeader
              title="Personal Details"
              subtitle="Update your display name, role title, and bio."
            />

            {profileSuccess && (
              <div className="p-3 mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
                <Check size={16} />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
                <AlertCircle size={16} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />

              <Input
                label="Role Title"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Lead Frontend Engineer"
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="A short introduction about yourself, your responsibilities, or interests..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block text-right">
                  {bio.length}/500 characters
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={profileSaving}
                >
                  {profileSaving ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: Account & Security */}
      {activeTab === "account" && (
        <div className="max-w-2xl space-y-6">
          <Card className="p-6">
            <CardHeader
              title="Email Address"
              subtitle="Your primary account identifier."
            />
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {authUser?.email}
              </span>
              <Badge variant="neutral">Verified</Badge>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Email addresses are linked to your sign-in identity and cannot be changed arbitrarily.
            </p>
          </Card>

          <Card className="p-6">
            <CardHeader
              title="Change Password"
              subtitle="Ensure your account is protected with a strong password."
            />

            {passwordSuccess && (
              <div className="p-3 mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
                <Check size={16} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
                <AlertCircle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {!authUser?.googleUser && (
                <Input
                  type="password"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              )}

              <Input
                type="password"
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />

              <Input
                type="password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={passwordSaving}
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 3: Preferences */}
      {activeTab === "preferences" && (
        <div className="max-w-2xl space-y-6">
          <Card className="p-6">
            <CardHeader
              title="Theme & Appearance"
              subtitle="Customize the look and feel of Klavo on this device."
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <button
                type="button"
                onClick={() => theme !== "light" && toggleTheme()}
                className={`p-4 rounded-xl border text-left flex flex-col items-center gap-2 transition ${
                  theme === "light"
                    ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg">
                  ☀️
                </div>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                  Light Theme
                </span>
                <span className="text-[10px] text-slate-400 text-center">
                  Clean lavender & high contrast
                </span>
              </button>

              <button
                type="button"
                onClick={() => theme !== "dark" && toggleTheme()}
                className={`p-4 rounded-xl border text-left flex flex-col items-center gap-2 transition ${
                  theme === "dark"
                    ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 text-lg">
                  🌙
                </div>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                  Dark Theme
                </span>
                <span className="text-[10px] text-slate-400 text-center">
                  Deep purple night mode
                </span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Workspace Settings */}
      {activeTab === "workspace" && (
        <div className="space-y-6">
          {/* Workspace Selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
              Active Workspace:
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              {workspaces.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} {w.owner?._id === authUser?._id ? "(Owner)" : ""}
                </option>
              ))}
            </select>
          </div>

          {activeWorkspace ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Workspace Logo Card */}
              <Card className="p-6 flex flex-col items-center text-center">
                <div className="relative group mb-4">
                  {wsLogo ? (
                    <img
                      src={wsLogo}
                      alt={wsName}
                      className="w-24 h-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-md">
                      {wsName.slice(0, 2).toUpperCase() || "WS"}
                    </div>
                  )}

                  {isWorkspaceAdmin && (
                    <label
                      htmlFor="ws-logo-upload"
                      className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs cursor-pointer transition"
                      title="Upload Workspace Logo"
                    >
                      <Camera size={20} className="mb-1" />
                      <span>Change</span>
                    </label>
                  )}
                  <input
                    id="ws-logo-upload"
                    type="file"
                    accept="image/*"
                    disabled={!isWorkspaceAdmin}
                    onChange={handleWorkspaceLogoChange}
                    className="hidden"
                  />
                </div>

                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {wsName}
                </h3>
                <Badge
                  variant={isWorkspaceOwner ? "primary" : isWorkspaceAdmin ? "info" : "neutral"}
                  className="mt-1 capitalize"
                >
                  {currentUserRole}
                </Badge>
                <p className="text-xs text-slate-400 mt-2">
                  {activeWorkspace.members?.length || 1} team members
                </p>

                {/* Owner Administrative Actions (UX-06) */}
                {isWorkspaceOwner && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 w-full space-y-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      className="w-full flex items-center justify-center gap-1.5"
                      onClick={() => setTransferModalOpen(true)}
                    >
                      <ArrowRightLeft size={13} />
                      Transfer Ownership
                    </Button>

                    <Button
                      variant="danger"
                      size="xs"
                      className="w-full flex items-center justify-center gap-1.5"
                      onClick={() => setDeleteModalOpen(true)}
                    >
                      <Trash2 size={13} />
                      Delete Workspace
                    </Button>
                  </div>
                )}
              </Card>

              {/* Workspace Edit Form */}
              <Card className="md:col-span-2 p-6">
                <CardHeader
                  title="Workspace Information"
                  subtitle="Workspace name and shared description."
                />

                {workspaceSuccess && (
                  <div className="p-3 mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
                    <Check size={16} />
                    <span>{workspaceSuccess}</span>
                  </div>
                )}

                {workspaceError && (
                  <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
                    <AlertCircle size={16} />
                    <span>{workspaceError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveWorkspace} className="space-y-4">
                  <Input
                    label="Workspace Name"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    disabled={!isWorkspaceAdmin}
                    placeholder="Engineering Team"
                    required
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={wsDescription}
                      onChange={(e) => setWsDescription(e.target.value)}
                      disabled={!isWorkspaceAdmin}
                      maxLength={500}
                      rows={3}
                      placeholder="Workspace purpose, mission, or projects overview..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <span className="text-[10px] text-slate-400 block text-right">
                      {wsDescription.length}/500 characters
                    </span>
                  </div>

                  {!isWorkspaceAdmin && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                      Only workspace owners and administrators can modify workspace details.
                    </p>
                  )}

                  {isWorkspaceAdmin && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={workspaceSaving}
                      >
                        {workspaceSaving ? "Saving..." : "Save Workspace"}
                      </Button>
                    </div>
                  )}
                </form>
              </Card>
            </div>
          ) : (
            <EmptyState
              title="No Workspace Selected"
              description="You do not belong to any workspace yet."
            />
          )}
        </div>
      )}

      {/* TAB 5: Members & Roles (UX-06) */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          {/* Header, Search & Add Member */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="Search by name, role, email..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Add Member Form (Admin/Owner only) */}
            {isWorkspaceAdmin ? (
              <form onSubmit={handleAddMember} className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="email"
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  placeholder="member@company.com"
                  required
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
                />

                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value)}
                  className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                </select>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={addMemberLoading}
                  className="shrink-0"
                >
                  <UserPlus size={14} className="mr-1" />
                  {addMemberLoading ? "Adding..." : "Add"}
                </Button>
              </form>
            ) : (
              <span className="text-xs text-slate-400 italic">
                Only workspace administrators can invite new members.
              </span>
            )}
          </div>

          {memberActionError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
              <AlertCircle size={16} />
              <span>{memberActionError}</span>
            </div>
          )}

          {/* Members Grid with Role Management */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {directoryMembers.map((member) => {
              const role = getMemberRole(member._id);
              const isOwner = role === "owner";
              const isMe = member._id === authUser?._id;
              const canEditThisRole =
                isWorkspaceOwner
                  ? !isOwner
                  : isWorkspaceAdmin
                  ? role !== "owner" && role !== "admin"
                  : false;

              return (
                <Card
                  key={member._id}
                  className="p-4 flex flex-col justify-between hover:border-indigo-500/40 transition group cursor-pointer"
                  onClick={() => setProfilePreviewUser({ ...member, role })}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={member.avatar}
                      name={member.name}
                      size="lg"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {member.name}
                        </span>
                        {isMe && <Badge variant="neutral" size="xs">You</Badge>}
                      </div>
                      <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                        {member.email}
                      </span>

                      {/* Role Selector or Badge */}
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        {canEditThisRole ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-medium">Role:</span>
                            <select
                              value={role}
                              onChange={(e) => handleRoleChange(member._id, e.target.value)}
                              className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 capitalize focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="guest">Guest</option>
                            </select>
                          </div>
                        ) : (
                          <Badge
                            variant={
                              role === "owner"
                                ? "primary"
                                : role === "admin"
                                ? "info"
                                : role === "guest"
                                ? "warning"
                                : "neutral"
                            }
                            size="xs"
                            className="capitalize"
                          >
                            {role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {member.bio && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      "{member.bio}"
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-indigo-500 group-hover:underline">
                      View profile preview →
                    </span>

                    {/* Remove Member: Owner can remove any non-owner; Admin can remove non-admin/non-owner; Member can self-leave */}
                    {((isWorkspaceOwner && !isOwner) ||
                      (isWorkspaceAdmin && role !== "owner" && role !== "admin") ||
                      (!isWorkspaceAdmin && isMe && !isOwner)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMember(member._id);
                        }}
                        className="text-slate-400 hover:text-rose-500 transition p-1"
                        title={isMe ? "Leave workspace" : "Remove member"}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {directoryMembers.length === 0 && (
            <EmptyState
              title="No Members Found"
              description="No workspace members match your search criteria."
            />
          )}
        </div>
      )}

      {/* Member Profile Preview Modal */}
      {profilePreviewUser && (
        <Modal
          isOpen={Boolean(profilePreviewUser)}
          onClose={() => setProfilePreviewUser(null)}
          title="Member Profile"
          size="sm"
        >
          <div className="flex flex-col items-center text-center p-2 space-y-3">
            <Avatar
              src={profilePreviewUser.avatar}
              name={profilePreviewUser.name}
              size="xl"
              className="w-20 h-20 text-xl border-2 border-indigo-500/20 shadow-md"
            />
            <div>
              <div className="flex items-center justify-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {profilePreviewUser.name}
                </h3>
                {profilePreviewUser.role && (
                  <Badge variant="primary" size="xs" className="capitalize">
                    {profilePreviewUser.role}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                {profilePreviewUser.roleTitle || "Team Member"}
              </p>
              <p className="text-xs text-slate-400 mt-1">{profilePreviewUser.email}</p>
            </div>

            {profilePreviewUser.bio && (
              <div className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 mt-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  About
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                  "{profilePreviewUser.bio}"
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Ownership Transfer Modal (UX-06) */}
      {transferModalOpen && (
        <Modal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          title="Transfer Workspace Ownership"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="ghost" size="sm" onClick={() => setTransferModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleTransferOwnership}
                disabled={!selectedNewOwnerId || transferring}
              >
                {transferring ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <p>
              Transferring ownership of <strong>{activeWorkspace?.name}</strong> is an irreversible action.
              The designated member will become the new Owner with full administrative control, and your role will transition to Administrator.
            </p>

            {transferError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{transferError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Select New Owner:
              </label>
              <select
                value={selectedNewOwnerId}
                onChange={(e) => setSelectedNewOwnerId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Choose active member --</option>
                {(activeWorkspace?.members || [])
                  .filter((m) => m._id !== authUser?._id)
                  .map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Workspace Confirmation Modal (UX-06) */}
      {deleteModalOpen && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Delete Workspace"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="ghost" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteWorkspace}
                disabled={deleteConfirmName !== activeWorkspace?.name || deletingWorkspace}
              >
                {deletingWorkspace ? "Deleting..." : "Permanently Delete"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
              <p className="font-semibold mb-1">Warning: Irreversible Deletion</p>
              <p>
                Deleting <strong>{activeWorkspace?.name}</strong> will permanently remove all associated projects, tasks, workflows, milestones, and shared files.
              </p>
            </div>

            <p>
              To confirm, please type the exact workspace name: <strong className="text-slate-900 dark:text-slate-100">{activeWorkspace?.name}</strong>
            </p>

            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={activeWorkspace?.name}
              required
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
