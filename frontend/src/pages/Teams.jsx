import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import TeamModal from "../components/TeamModal";
import AddMemberModal from "../components/AddMemberModal";

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openAddMemberModal, setOpenAddMemberModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const fetchTeams = async () => {
    const res = await axiosClient.get("/teams/my-teams");
    setTeams(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleNewTeam = (team) => {
    setTeams((prev) => [...prev, team]);
  };

  const openAddMember = (teamId) => {
    setSelectedTeamId(teamId);
    setOpenAddMemberModal(true);
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Teams</h1>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded"
            onClick={() => setOpenCreateModal(true)}
          >
            + Create Team
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teams.map((team) => (
            <div key={team._id} className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-semibold">{team.name}</h2>

              <h3 className="mt-3 font-medium">Members:</h3>
              <ul className="list-disc pl-5 text-sm text-slate-600">
                {team.members.map((m) => (
                  <li key={m._id}>{m.name} ({m.email})</li>
                ))}
              </ul>

              <button
                className="mt-4 w-full border py-2 rounded text-indigo-600"
                onClick={() => openAddMember(team._id)}
              >
                + Add Member
              </button>
            </div>
          ))}
        </div>
      </div>

      <TeamModal open={openCreateModal} onClose={() => setOpenCreateModal(false)} onSuccess={handleNewTeam} />
      
      <AddMemberModal
        open={openAddMemberModal}
        onClose={() => setOpenAddMemberModal(false)}
        teamId={selectedTeamId}
        onSuccess={fetchTeams}
      />
    </div>
  );
}
