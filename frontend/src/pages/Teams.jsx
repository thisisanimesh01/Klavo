import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import TeamModal from "../components/TeamModal";
import AddMemberModal from "../components/AddMemberModal";
import { Button, Card, EmptyState, LoadingState, Badge } from "../components/ui";
import { Users, Plus, UserPlus, Trash2 } from "lucide-react";

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openAddMemberModal, setOpenAddMemberModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

 // fetch teams the user belongs to
  const fetchTeams = async () => {
    try {
      const res = await axiosClient.get("/teams/my-teams");
      setTeams(res.data);
    } catch (err) {
      console.error("Error loading teams:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  //delete team
  const deleteTeam = async (id) => {
    if (!confirm("Are you sure you want to delete this team?")) return;

    try {
      await axiosClient.delete(`/teams/${id}`);
      fetchTeams(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Failed to delete team");
    }
  };

  //loading state
  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* PAGE HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Teams</h1>

          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded"
            onClick={() => setOpenCreateModal(true)}
          >
            + Create Team
          </button>
        </div>

        {/* IF NO TEAMS */}
        {teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No teams or workspaces yet"
            description="Create your first team workspace to start inviting members and collaborating on projects."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={Plus}
                onClick={() => setOpenCreateModal(true)}
              >
                Create Team
              </Button>
            }
          />
        ) : (
          /* TEAM CARDS */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.map((team) => (
              <div key={team._id} className="bg-white p-4 rounded shadow">

                {/* TEAM NAME */}
                <h2 className="text-lg font-semibold">{team.name}</h2>

                {/* MEMBERS LIST */}
                <h3 className="mt-3 font-medium">Members:</h3>
                <ul className="list-disc pl-5 text-sm text-slate-600">
                  {team.members.map((m) => (
                    <li key={m._id}>{m.name} ({m.email})</li>
                  ))}
                </ul>

                {/* ADD MEMBER BUTTON */}
                <button
                  className="mt-4 w-full border py-2 rounded text-indigo-600"
                  onClick={() => {
                    setSelectedTeamId(team._id);
                    setOpenAddMemberModal(true);
                  }}
                >
                  + Add Member
                </button>

                {/* DELETE TEAM BUTTON */}
                <button
                  className="mt-4 w-full border py-2 rounded text-red-600"
                  onClick={() => deleteTeam(team._id)}
                >
                  Delete Team
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALS */}
      <TeamModal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        onSuccess={fetchTeams}
      />

      <AddMemberModal
        open={openAddMemberModal}
        onClose={() => setOpenAddMemberModal(false)}
        teamId={selectedTeamId}
        onSuccess={fetchTeams}
      />
    </div>
  );
}
