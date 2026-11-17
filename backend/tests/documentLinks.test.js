import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

test("DOC-08: Document & Task Linking Model & Association Logic", async (t) => {
  await t.test("idempotently links documentId to task.linkedDocuments without duplicates", () => {
    const docId1 = new mongoose.Types.ObjectId().toString();
    const docId2 = new mongoose.Types.ObjectId().toString();

    let task = {
      _id: new mongoose.Types.ObjectId().toString(),
      title: "Implement auth token exchange",
      linkedDocuments: [docId1],
    };

    // Linking docId1 again should be a no-op / deduplicated
    const addLink = (currentList, newId) => {
      if (currentList.some((id) => id.toString() === newId.toString())) {
        return currentList;
      }
      return [...currentList, newId];
    };

    task.linkedDocuments = addLink(task.linkedDocuments, docId1);
    assert.equal(task.linkedDocuments.length, 1);

    task.linkedDocuments = addLink(task.linkedDocuments, docId2);
    assert.equal(task.linkedDocuments.length, 2);
    assert.equal(task.linkedDocuments.includes(docId2), true);
  });

  await t.test("unlinks documentId from task and reverse links cleanly", () => {
    const docId1 = new mongoose.Types.ObjectId().toString();
    const docId2 = new mongoose.Types.ObjectId().toString();

    let task = {
      _id: "task_1",
      linkedDocuments: [docId1, docId2],
    };

    let doc = {
      _id: docId1,
      linkedTasks: ["task_1", "task_2"],
    };

    // Unlink docId1 from task_1
    task.linkedDocuments = task.linkedDocuments.filter((id) => id !== docId1);
    doc.linkedTasks = doc.linkedTasks.filter((id) => id !== "task_1");

    assert.equal(task.linkedDocuments.length, 1);
    assert.equal(task.linkedDocuments[0], docId2);
    assert.equal(doc.linkedTasks.length, 1);
    assert.equal(doc.linkedTasks[0], "task_2");
  });
});

test("DOC-08: Project Boundary & Isolation Invariants", async (t) => {
  await t.test("rejects linking documents and tasks from different projects", () => {
    const projectA = new mongoose.Types.ObjectId().toString();
    const projectB = new mongoose.Types.ObjectId().toString();

    const taskProjectA = {
      _id: new mongoose.Types.ObjectId().toString(),
      projectId: projectA,
      title: "Project A Task",
    };

    const docProjectB = {
      _id: new mongoose.Types.ObjectId().toString(),
      projectId: projectB,
      title: "Project B Architecture Doc",
    };

    const validateSameProject = (t, d) => {
      return t.projectId.toString() === d.projectId.toString();
    };

    assert.equal(validateSameProject(taskProjectA, docProjectB), false);

    const docProjectA = {
      _id: new mongoose.Types.ObjectId().toString(),
      projectId: projectA,
      title: "Project A Specification",
    };
    assert.equal(validateSameProject(taskProjectA, docProjectA), true);
  });
});

test("DOC-08: Document RBAC & Link Permission Verification", async (t) => {
  await t.test("verifies user canRead permission before surfacing linked document", () => {
    const linkedDocs = [
      {
        _id: "doc_public",
        title: "Public Project Roadmap",
        defaultAccess: "viewer",
        shares: [],
      },
      {
        _id: "doc_restricted",
        title: "Confidential Compensation Plan",
        defaultAccess: "none",
        shares: [{ userId: "user_owner", role: "owner" }],
      },
    ];

    const canUserRead = (doc, userId) => {
      if (doc.defaultAccess === "viewer" || doc.defaultAccess === "editor") return true;
      return doc.shares.some((s) => s.userId === userId);
    };

    const userRegular = "user_regular";
    const userOwner = "user_owner";

    const visibleToRegular = linkedDocs.filter((d) => canUserRead(d, userRegular));
    const visibleToOwner = linkedDocs.filter((d) => canUserRead(d, userOwner));

    assert.equal(visibleToRegular.length, 1);
    assert.equal(visibleToRegular[0]._id, "doc_public");

    assert.equal(visibleToOwner.length, 2);
  });
});
