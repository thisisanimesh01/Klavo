/**
 * Shared test fixtures for authentication, authorization, and route validation.
 */
export const mockUsers = {
  alice: {
    _id: "usr_alice_001",
    name: "Alice Owner",
    email: "alice@example.com",
    avatar: "https://example.com/alice.png",
  },
  bob: {
    _id: "usr_bob_002",
    name: "Bob Member",
    email: "bob@example.com",
    avatar: "https://example.com/bob.png",
  },
  eve: {
    _id: "usr_eve_003",
    name: "Eve Attacker",
    email: "eve@example.com",
    avatar: "https://example.com/eve.png",
  },
};

export const mockTeams = {
  teamAlpha: {
    _id: "team_alpha_101",
    name: "Team Alpha",
    owner: mockUsers.alice._id,
    members: [mockUsers.alice._id, mockUsers.bob._id],
  },
};

export const mockProjects = {
  projectAlpha: {
    _id: "proj_alpha_201",
    name: "Project Alpha",
    teamId: mockTeams.teamAlpha._id,
    createdBy: mockUsers.alice._id,
  },
};

export const mockTasks = {
  task1: {
    _id: "task_001",
    title: "Implement automated tests",
    description: "Write unit and integration tests",
    status: "in-progress",
    priority: "high",
    dueDate: new Date("2026-12-31"),
    projectId: mockProjects.projectAlpha._id,
    assignedTo: [mockUsers.alice._id],
    createdBy: mockUsers.alice._id,
    order: 0,
  },
};
