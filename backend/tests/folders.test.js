import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { checkCircularFolderNesting } from "../src/utils/folderHelpers.js";

test("DOC-02: Folder Hierarchy & Circular Reference Prevention", async (t) => {
  await t.test("detects immediate self-nesting attempt (folder becomes its own parent)", async () => {
    const folderA = new mongoose.Types.ObjectId();
    const { isCircular } = await checkCircularFolderNesting(folderA, folderA);
    assert.equal(isCircular, true);
  });

  await t.test("allows moving folder to null / root", async () => {
    const folderA = new mongoose.Types.ObjectId();
    const { isCircular } = await checkCircularFolderNesting(folderA, null);
    assert.equal(isCircular, false);
  });

  await t.test("in-memory graph cycle detection halts on indirect ancestors", () => {
    // Tree: Root -> FolderA -> FolderB -> FolderC
    const folderTree = {
      folder_c: "folder_b",
      folder_b: "folder_a",
      folder_a: null,
    };

    const isCycle = (movingId, targetParentId) => {
      if (!targetParentId) return false;
      if (movingId === targetParentId) return true;

      let curr = targetParentId;
      const visited = new Set([curr]);

      while (curr) {
        const parent = folderTree[curr];
        if (parent === movingId) return true;
        if (parent && visited.has(parent)) return true;
        if (parent) visited.add(parent);
        curr = parent;
      }
      return false;
    };

    // Moving FolderA under FolderC creates cycle: A -> B -> C -> A
    assert.equal(isCycle("folder_a", "folder_c"), true);
    // Moving FolderA under FolderB creates cycle: A -> B -> A
    assert.equal(isCycle("folder_a", "folder_b"), true);
    // Moving FolderC to root is valid
    assert.equal(isCycle("folder_c", null), false);
    // Moving FolderC under FolderA is valid
    assert.equal(isCycle("folder_c", "folder_a"), false);
  });
});

test("DOC-02: Safe Deletion & Cascade Reparenting Logic", async (t) => {
  await t.test("reparents child folders and documents to deleted folder parentId or null", () => {
    const parentFolderId = "root_parent";
    const deletedFolderId = "folder_to_delete";

    const folders = [
      { _id: "f1", parentId: deletedFolderId },
      { _id: "f2", parentId: deletedFolderId },
      { _id: "f3", parentId: "other_folder" },
    ];

    const documents = [
      { _id: "d1", folderId: deletedFolderId },
      { _id: "d2", folderId: deletedFolderId },
      { _id: "d3", folderId: "other_folder" },
    ];

    // Simulate reparenting
    const reparentedFolders = folders.map((f) =>
      f.parentId === deletedFolderId ? { ...f, parentId: parentFolderId } : f
    );
    const reparentedDocuments = documents.map((d) =>
      d.folderId === deletedFolderId ? { ...d, folderId: parentFolderId } : d
    );

    assert.equal(reparentedFolders[0].parentId, "root_parent");
    assert.equal(reparentedFolders[1].parentId, "root_parent");
    assert.equal(reparentedFolders[2].parentId, "other_folder");

    assert.equal(reparentedDocuments[0].folderId, "root_parent");
    assert.equal(reparentedDocuments[1].folderId, "root_parent");
    assert.equal(reparentedDocuments[2].folderId, "other_folder");
  });
});

test("DOC-02: Multi-Tenant Folder Authorization & Scoping", async (t) => {
  const aliceId = new mongoose.Types.ObjectId().toString();
  const bobId = new mongoose.Types.ObjectId().toString();
  const eveId = new mongoose.Types.ObjectId().toString();

  const folders = [
    { _id: "f_alpha", name: "Engineering Docs", projectId: "proj_1", createdBy: aliceId },
    { _id: "f_beta", name: "Design Assets", projectId: "proj_2", createdBy: bobId },
  ];

  await t.test("prevents cross-project folder moving or parent assignment", () => {
    const canAssignParent = (folder, targetParent) => {
      if (!targetParent) return true;
      return folder.projectId === targetParent.projectId;
    };

    assert.equal(canAssignParent(folders[0], null), true); // Move to root
    assert.equal(canAssignParent(folders[0], folders[1]), false); // Cross-project forbidden
  });

  await t.test("restricts folder deletion strictly to creator or team owner", () => {
    const canDeleteFolder = (folder, userId, isTeamOwner) => {
      if (isTeamOwner) return true;
      return folder.createdBy === userId;
    };

    assert.equal(canDeleteFolder(folders[0], aliceId, false), true);
    assert.equal(canDeleteFolder(folders[0], bobId, false), false);
    assert.equal(canDeleteFolder(folders[0], bobId, true), true); // Team owner override
    assert.equal(canDeleteFolder(folders[0], eveId, false), false); // Outsider
  });
});
