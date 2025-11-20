const deleteTeam = async (id) => {
  if (!confirm("Delete this team?")) return;

  await axiosClient.delete(`/teams/${id}`);

  loadTeams();
};
