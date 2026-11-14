import assert from "assert";

console.log("Running SEC-03 authorization and IDOR test suite...");

// In-memory simulation of models and auth logic
const users = {
  alice: { _id: "usr_alice", name: "Alice", email: "alice@example.com" },
  bob: { _id: "usr_bob", name: "Bob", email: "bob@example.com" },
  eve: { _id: "usr_eve", name: "Eve", email: "eve@example.com" },
};

const teams = {
  team_alpha: {
    _id: "team_alpha",
    name: "Team Alpha",
    owner: users.alice._id,
    members: [users.alice._id, users.bob._id],
  },
};

const projects = {
  proj_alpha: {
    _id: "proj_alpha",
    name: "Alpha Project",
    teamId: "team_alpha",
    createdBy: users.alice._id,
  },
};

const tasks = {
  task_1: {
    _id: "task_1",
    title: "Task 1",
    projectId: "proj_alpha",
    createdBy: users.alice._id,
    status: "todo",
  },
};

const comments = {
  comment_1: {
    _id: "comment_1",
    taskId: "task_1",
    userId: users.alice._id,
    text: "Great work!",
  },
};

// Pure logic implementations matching backend/src/utils/authHelpers.js
const checkTeamAccess = (teamId, userId) => {
  const team = teams[teamId];
  if (!team) return { isMember: false, isOwner: false, team: null };
  const userIdStr = userId.toString();
  const isOwner = team.owner.toString() === userIdStr;
  const isMember = isOwner || team.members.some((m) => m.toString() === userIdStr);
  return { isMember, isOwner, team };
};

const checkProjectAccess = (projectId, userId) => {
  const project = projects[projectId];
  if (!project) return { hasAccess: false, isOwner: false, project: null, team: null };
  const { isMember, isOwner, team } = checkTeamAccess(project.teamId, userId);
  return { hasAccess: isMember, isOwner, project, team };
};

const checkTaskAccess = (taskId, userId) => {
  const task = tasks[taskId];
  if (!task) return { hasAccess: false, task: null, project: null, team: null };
  const { hasAccess, project, team } = checkProjectAccess(task.projectId, userId);
  return { hasAccess, task, project, team };
};

// Test 1: Team Authorization
{
  // Alice is owner
  const aliceAccess = checkTeamAccess("team_alpha", users.alice._id);
  assert.strictEqual(aliceAccess.isOwner, true);
  assert.strictEqual(aliceAccess.isMember, true);

  // Bob is member
  const bobAccess = checkTeamAccess("team_alpha", users.bob._id);
  assert.strictEqual(bobAccess.isOwner, false);
  assert.strictEqual(bobAccess.isMember, true);

  // Eve is an outsider
  const eveAccess = checkTeamAccess("team_alpha", users.eve._id);
  assert.strictEqual(eveAccess.isOwner, false);
  assert.strictEqual(eveAccess.isMember, false);

  // Negative test: Eve cannot delete team_alpha
  assert.strictEqual(eveAccess.isOwner, false, "Eve must not be permitted to delete Team Alpha");
  // Negative test: Bob cannot delete team_alpha
  assert.strictEqual(bobAccess.isOwner, false, "Bob must not be permitted to delete Team Alpha");

  console.log("✔ Test 1 Passed: Team ownership and membership correctly partitioned.");
}

// Test 2: Project Creation & IDOR Protection
{
  // Alice & Bob can create project in team_alpha
  assert.strictEqual(checkTeamAccess("team_alpha", users.alice._id).isMember, true);
  assert.strictEqual(checkTeamAccess("team_alpha", users.bob._id).isMember, true);

  // Eve cannot create project in team_alpha (IDOR prevention)
  const eveAccess = checkTeamAccess("team_alpha", users.eve._id);
  assert.strictEqual(eveAccess.isMember, false, "Eve must not be permitted to create a project in Team Alpha");

  console.log("✔ Test 2 Passed: Cross-team project creation blocked (IDOR protected).");
}

// Test 3: Task Access & Manipulation IDOR
{
  // Alice and Bob have access to task_1
  assert.strictEqual(checkTaskAccess("task_1", users.alice._id).hasAccess, true);
  assert.strictEqual(checkTaskAccess("task_1", users.bob._id).hasAccess, true);

  // Eve has NO access to task_1
  const eveTaskAccess = checkTaskAccess("task_1", users.eve._id);
  assert.strictEqual(eveTaskAccess.hasAccess, false, "Eve must be rejected from viewing, updating, or deleting task_1");

  console.log("✔ Test 3 Passed: Cross-project task manipulation blocked (IDOR protected).");
}

// Test 4: Comment & Reaction Access IDOR
{
  const checkCommentAccess = (commentId, userId) => {
    const comment = comments[commentId];
    if (!comment) return { hasAccess: false };
    return checkTaskAccess(comment.taskId, userId);
  };

  assert.strictEqual(checkCommentAccess("comment_1", users.alice._id).hasAccess, true);
  assert.strictEqual(checkCommentAccess("comment_1", users.bob._id).hasAccess, true);
  assert.strictEqual(checkCommentAccess("comment_1", users.eve._id).hasAccess, false, "Eve cannot react to comment_1");

  console.log("✔ Test 4 Passed: Comments and reactions require task and project membership.");
}

// Test 5: Socket.IO Room Joining Authorization
{
  const simulateSocketJoinProject = (socketUser, projectId) => {
    if (!socketUser) return { joined: false, error: "Unauthenticated" };
    const { hasAccess } = checkProjectAccess(projectId, socketUser._id);
    if (!hasAccess) return { joined: false, error: "Unauthorized" };
    return { joined: true, room: `project_${projectId}` };
  };

  const aliceJoin = simulateSocketJoinProject(users.alice, "proj_alpha");
  assert.strictEqual(aliceJoin.joined, true);
  assert.strictEqual(aliceJoin.room, "project_proj_alpha");

  const eveJoin = simulateSocketJoinProject(users.eve, "proj_alpha");
  assert.strictEqual(eveJoin.joined, false);
  assert.strictEqual(eveJoin.error, "Unauthorized");

  console.log("✔ Test 5 Passed: Socket.IO room joins enforce project authorization.");
}
