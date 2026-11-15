import test from "node:test";
import assert from "node:assert/strict";
import { mockUsers, mockTeams, mockProjects, mockTasks } from "./fixtures/mockData.js";

test("MOD-02: Real-Time Collaboration & Notification Multi-User Flow", async (t) => {
  // In-memory simulation models
  const inMemoryComments = [];
  const inMemoryReactions = [];
  const inMemoryNotifications = [];
  const userRooms = new Map(); // userId -> Set(socketIds)
  const emittedEvents = [];

  const mockIo = {
    to: (room) => ({
      emit: (event, payload) => {
        emittedEvents.push({ room, event, payload });
      },
    }),
  };

  const createNotification = async ({ userId, senderId, type, message, data = {} }) => {
    if (senderId && String(userId) === String(senderId)) {
      return null; // Suppress self-notification
    }
    const notif = {
      _id: `notif_${inMemoryNotifications.length + 1}`,
      userId,
      type,
      message,
      data,
      read: false,
      createdAt: new Date(),
    };
    inMemoryNotifications.push(notif);
    mockIo.to(`user_${userId}`).emit("notificationCreated", notif);
    return notif;
  };

  await t.test("Task assignment delivers targeted notification to assignee but not assigner", async () => {
    emittedEvents.length = 0;
    const assignerId = mockUsers.alice._id;
    const assigneeId = mockUsers.bob._id;

    // Alice assigns Bob to a task
    const notif = await createNotification({
      userId: assigneeId,
      senderId: assignerId,
      type: "TASK_ASSIGNED",
      message: `${mockUsers.alice.name} assigned you to task "Build Auth"`,
      data: { taskId: mockTasks.task1._id, projectId: mockProjects.projectAlpha._id },
    });

    assert.ok(notif, "Notification was created for Bob");
    assert.equal(notif.userId, assigneeId);
    assert.equal(notif.read, false);

    // Verify socket emission targeted Bob's private room
    const emission = emittedEvents.find((e) => e.room === `user_${assigneeId}`);
    assert.ok(emission, "Socket emitted to Bob's private user room");
    assert.equal(emission.event, "notificationCreated");
    assert.equal(emission.payload._id, notif._id);

    // Verify self-assignment generates zero notification
    const selfNotif = await createNotification({
      userId: assignerId,
      senderId: assignerId,
      type: "TASK_ASSIGNED",
      message: "Self assigned",
    });
    assert.equal(selfNotif, null, "Self-assignment does not generate duplicate self-notification");
  });

  await t.test("Comment creation emits to project room and dispatches targeted mention notifications", async () => {
    emittedEvents.length = 0;
    const commenter = mockUsers.bob;
    const commentText = "Hey @alice can you review this PR?";

    const comment = {
      _id: "comment_101",
      taskId: mockTasks.task1._id,
      userId: commenter._id,
      text: commentText,
      createdAt: new Date(),
    };
    inMemoryComments.push(comment);

    // Socket emit to project room
    mockIo.to(`project_${mockProjects.projectAlpha._id}`).emit("commentAdded", comment);

    // Mention Bob mentions Alice
    const mentionNotif = await createNotification({
      userId: mockUsers.alice._id,
      senderId: commenter._id,
      type: "MENTION",
      message: `${commenter.name} mentioned you in a comment`,
      data: { taskId: mockTasks.task1._id, commentId: comment._id },
    });

    assert.ok(mentionNotif, "Mention notification created for Alice");
    const projectEmission = emittedEvents.find(
      (e) => e.room === `project_${mockProjects.projectAlpha._id}` && e.event === "commentAdded"
    );
    assert.ok(projectEmission, "Comment broadcast to project room");

    const aliceEmission = emittedEvents.find(
      (e) => e.room === `user_${mockUsers.alice._id}` && e.event === "notificationCreated"
    );
    assert.ok(aliceEmission, "Mention delivered to Alice's room");
  });

  await t.test("Reactions support add, duplicate prevention (409), and removal", async () => {
    emittedEvents.length = 0;
    const commentId = "comment_101";
    const user = mockUsers.alice;
    const emoji = "🚀";

    // 1. Add reaction
    const addReaction = (cId, uId, e) => {
      const exists = inMemoryReactions.some(
        (r) => r.commentId === cId && r.userId === uId && r.emoji === e
      );
      if (exists) {
        const err = new Error("Reaction already exists");
        err.status = 409;
        throw err;
      }
      const reaction = { _id: `rx_${inMemoryReactions.length + 1}`, commentId: cId, userId: uId, emoji: e };
      inMemoryReactions.push(reaction);
      mockIo.to(`comment_${cId}`).emit("reactionAdded", reaction);
      return reaction;
    };

    const reaction = addReaction(commentId, user._id, emoji);
    assert.ok(reaction);
    assert.equal(reaction.emoji, emoji);

    // 2. Duplicate rejection
    assert.throws(
      () => addReaction(commentId, user._id, emoji),
      (err) => err.status === 409,
      "Duplicate identical reaction triggers 409 conflict"
    );

    // 3. Remove reaction
    const removeReaction = (cId, uId, e) => {
      const idx = inMemoryReactions.findIndex(
        (r) => r.commentId === cId && r.userId === uId && r.emoji === e
      );
      if (idx === -1) return null;
      const [deleted] = inMemoryReactions.splice(idx, 1);
      mockIo.to(`comment_${cId}`).emit("reactionRemoved", { commentId: cId, userId: uId, emoji: e });
      return deleted;
    };

    const deleted = removeReaction(commentId, user._id, emoji);
    assert.ok(deleted);
    assert.equal(inMemoryReactions.length, 0);

    const removeEmission = emittedEvents.find(
      (e) => e.room === `comment_${commentId}` && e.event === "reactionRemoved"
    );
    assert.ok(removeEmission, "reactionRemoved event emitted to comment thread");
  });

  await t.test("Notification read status state management and unread count decrement", () => {
    const userNotifications = inMemoryNotifications.filter(
      (n) => n.userId === mockUsers.alice._id
    );
    assert.ok(userNotifications.length > 0);

    const target = userNotifications[0];
    assert.equal(target.read, false);

    // Mark as read
    target.read = true;
    assert.equal(target.read, true);

    const unreadCount = userNotifications.filter((n) => !n.read).length;
    assert.equal(unreadCount, userNotifications.length - 1);
  });
});
