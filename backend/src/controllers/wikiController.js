import Document from "../models/Document.js";
import { Project } from "../models/Project.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { resolveDocumentAccess, DOCUMENT_ROLES } from "../utils/documentPermissions.js";
import { createDocumentVersionSnapshot } from "../utils/versionHelpers.js";
import {
  checkCircularWikiNesting,
  getWikiBreadcrumbs,
  buildWikiTree,
  slugifyWikiTitle,
} from "../utils/wikiHelpers.js";
import { logActivity } from "./activityController.js";
import {
  sanitizeDocumentHtml,
  sanitizeDocumentJson,
  extractPlainTextExcerpt,
} from "../utils/documentSanitizer.js";

/**
 * Creates a new wiki page within a project.
 * Supports parent-child nesting via `parentWikiId`, ordering, and setting as Project Wiki Home.
 */
export const createWikiPage = async (req, res) => {
  try {
    const {
      title,
      content,
      contentHtml,
      projectId,
      parentWikiId,
      wikiOrder,
      isWikiHome,
      defaultAccess,
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to create wiki pages in this project",
      });
    }

    // Validate parentWikiId if provided
    let safeParentWikiId = null;
    if (parentWikiId && parentWikiId !== "null" && parentWikiId !== "root") {
      const parentPage = await Document.findOne({
        _id: parentWikiId,
        projectId,
        isArchived: false,
      });

      if (!parentPage) {
        return res.status(400).json({
          message: "Parent wiki page not found or belongs to a different project",
        });
      }
      safeParentWikiId = parentPage._id;
    }

    const safeTitle = (title && title.trim()) || "Untitled Wiki Page";
    const safeHtml = sanitizeDocumentHtml(contentHtml || "<p></p>");
    const safeJson = sanitizeDocumentJson(content);
    const excerpt = extractPlainTextExcerpt(safeHtml);
    const safeDefaultAccess = DOCUMENT_ROLES.includes(defaultAccess) ? defaultAccess : "editor";
    const slug = slugifyWikiTitle(safeTitle);

    // If marked as wiki home, clear existing isWikiHome for this project
    let isHome = Boolean(isWikiHome);
    if (isHome) {
      await Document.updateMany({ projectId, isWikiHome: true }, { isWikiHome: false });
    } else {
      // If this is the very first wiki page in the project, automatically designate as Home
      const existingWikiCount = await Document.countDocuments({
        projectId,
        isWiki: true,
        isArchived: false,
      });
      if (existingWikiCount === 0) {
        isHome = true;
      }
    }

    const wikiDoc = await Document.create({
      title: safeTitle,
      content: safeJson,
      contentHtml: safeHtml,
      description: excerpt,
      isWiki: true,
      isWikiHome: isHome,
      parentWikiId: safeParentWikiId,
      wikiOrder: Number.isFinite(Number(wikiOrder)) ? Number(wikiOrder) : 0,
      wikiSlug: slug,
      projectId,
      teamId: project.teamId,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
      defaultAccess: safeDefaultAccess,
      shares: [],
    });

    // Create initial revision #1 snapshot
    await createDocumentVersionSnapshot({
      documentId: wikiDoc._id,
      projectId: wikiDoc.projectId,
      title: wikiDoc.title,
      content: wikiDoc.content,
      contentHtml: wikiDoc.contentHtml,
      description: wikiDoc.description,
      authorId: req.user._id,
      changeSummary: isHome ? "Initial project wiki home page" : "Initial wiki page",
      force: true,
    });

    await wikiDoc.populate("createdBy", "name email avatar");
    await wikiDoc.populate("lastUpdatedBy", "name email avatar");
    if (wikiDoc.parentWikiId) {
      await wikiDoc.populate("parentWikiId", "title isWikiHome wikiSlug");
    }

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Created Wiki Page",
      message: `${req.user.name} created wiki page "${safeTitle}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("wikiPageCreated", wikiDoc);
      io.to(`project_${projectId}`).emit("documentCreated", wikiDoc);
    }

    const docObj = wikiDoc.toObject();
    docObj.userPermission = {
      role: "owner",
      canRead: true,
      canComment: true,
      canEdit: true,
      canManagePermissions: true,
      canDelete: true,
    };
    docObj.breadcrumbs = await getWikiBreadcrumbs(wikiDoc._id);

    res.status(201).json(docObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves the Wiki Tree and all wiki pages for a project.
 * Supports search filtering and resolves breadcrumbs & permissions per page.
 */
export const getWikiPagesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { search, parentWikiId } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view the wiki in this project",
      });
    }

    const query = { projectId, isWiki: true, isArchived: false };

    if (parentWikiId !== undefined && parentWikiId !== "all") {
      if (parentWikiId === "root" || parentWikiId === "null" || parentWikiId === "") {
        query.parentWikiId = null;
      } else {
        query.parentWikiId = parentWikiId;
      }
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [{ title: regex }, { description: regex }];
    }

    const pages = await Document.find(query)
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .populate("parentWikiId", "title isWikiHome wikiSlug")
      .populate("shares.userId", "name email avatar")
      .sort({ wikiOrder: 1, createdAt: 1 });

    const pagesWithPermissions = await Promise.all(
      pages.map(async (doc) => {
        const perm = await resolveDocumentAccess(doc, req.user._id);
        const obj = doc.toObject();
        obj.userPermission = perm;
        return obj;
      })
    );

    const accessiblePages = pagesWithPermissions.filter((p) => p.userPermission.canRead);
    const tree = buildWikiTree(accessiblePages);

    res.json({
      pages: accessiblePages,
      tree,
      totalCount: accessiblePages.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves or lazily initializes the Project Wiki Home landing page.
 */
export const getWikiHome = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view the wiki in this project",
      });
    }

    // Try finding designated wiki home
    let homeDoc = await Document.findOne({
      projectId,
      isWiki: true,
      isWikiHome: true,
      isArchived: false,
    })
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .populate("shares.userId", "name email avatar");

    // If no explicit wiki home, pick the oldest root wiki page or any root wiki page
    if (!homeDoc) {
      homeDoc = await Document.findOne({
        projectId,
        isWiki: true,
        parentWikiId: null,
        isArchived: false,
      })
        .populate("createdBy", "name email avatar")
        .populate("lastUpdatedBy", "name email avatar")
        .populate("shares.userId", "name email avatar")
        .sort({ wikiOrder: 1, createdAt: 1 });

      if (homeDoc) {
        homeDoc.isWikiHome = true;
        await homeDoc.save();
      }
    }

    // If still no wiki page exists in the project, automatically seed an initial Home Page
    if (!homeDoc) {
      const defaultTitle = `${project.name} Project Wiki`;
      const defaultHtml = `<h2>Welcome to the ${project.name} Knowledge Base</h2><p>This is your project wiki workspace. Organize architectural documentation, API specs, onboarding guides, and team knowledge collaboratively in one place.</p><ul><li>Create child pages using the sidebar navigation.</li><li>Format content with rich text, headers, code blocks, and links.</li><li>Collaborate live with your team with version history and discussions.</li></ul>`;
      const defaultJson = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: `Welcome to the ${project.name} Knowledge Base` }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is your project wiki workspace. Organize architectural documentation, API specs, onboarding guides, and team knowledge collaboratively in one place.",
              },
            ],
          },
        ],
      };

      homeDoc = await Document.create({
        title: defaultTitle,
        content: defaultJson,
        contentHtml: defaultHtml,
        description: `Welcome to the ${project.name} Knowledge Base wiki`,
        isWiki: true,
        isWikiHome: true,
        parentWikiId: null,
        wikiOrder: 0,
        wikiSlug: slugifyWikiTitle(defaultTitle),
        projectId,
        teamId: project.teamId,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
        defaultAccess: "editor",
        shares: [],
      });

      await createDocumentVersionSnapshot({
        documentId: homeDoc._id,
        projectId: homeDoc.projectId,
        title: homeDoc.title,
        content: homeDoc.content,
        contentHtml: homeDoc.contentHtml,
        description: homeDoc.description,
        authorId: req.user._id,
        changeSummary: "Default Project Wiki Home created",
        force: true,
      });

      await homeDoc.populate("createdBy", "name email avatar");
      await homeDoc.populate("lastUpdatedBy", "name email avatar");
    }

    const perm = await resolveDocumentAccess(homeDoc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to view this wiki page",
      });
    }

    const homeObj = homeDoc.toObject();
    homeObj.userPermission = perm;
    homeObj.breadcrumbs = await getWikiBreadcrumbs(homeDoc._id);

    res.json(homeObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves a single wiki page by ID or slug within a project, including resolved breadcrumbs and permissions.
 */
export const getWikiPageById = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findOne({
      _id: documentId,
      isWiki: true,
      isArchived: false,
    })
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .populate("parentWikiId", "title isWikiHome wikiSlug")
      .populate("shares.userId", "name email avatar");

    if (!doc) {
      return res.status(404).json({ message: "Wiki page not found" });
    }

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to view this wiki page",
      });
    }

    const docObj = doc.toObject();
    docObj.userPermission = perm;
    docObj.breadcrumbs = await getWikiBreadcrumbs(doc._id);

    // Fetch immediate child pages
    const childPages = await Document.find({
      parentWikiId: doc._id,
      isWiki: true,
      isArchived: false,
    })
      .select("title isWikiHome wikiOrder wikiSlug updatedAt")
      .sort({ wikiOrder: 1, createdAt: 1 });

    docObj.children = childPages;

    res.json(docObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates a wiki page (title, content, parent hierarchy, order, home status).
 * Validates circular nesting, updates slug, and generates version snapshot.
 */
export const updateWikiPage = async (req, res) => {
  try {
    const { documentId } = req.params;
    const {
      title,
      content,
      contentHtml,
      parentWikiId,
      wikiOrder,
      isWikiHome,
      defaultAccess,
    } = req.body;

    const doc = await Document.findOne({
      _id: documentId,
      isWiki: true,
      isArchived: false,
    });

    if (!doc) return res.status(404).json({ message: "Wiki page not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canEdit) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to edit this wiki page",
      });
    }

    // Hierarchy change validation
    if (parentWikiId !== undefined) {
      if (
        parentWikiId === "root" ||
        parentWikiId === "null" ||
        parentWikiId === null ||
        parentWikiId === ""
      ) {
        doc.parentWikiId = null;
      } else {
        // Enforce same-project tenancy
        const targetParent = await Document.findOne({
          _id: parentWikiId,
          projectId: doc.projectId,
          isWiki: true,
          isArchived: false,
        });

        if (!targetParent) {
          return res.status(400).json({
            message: "Target parent wiki page not found or belongs to a different project",
          });
        }

        // Circular nesting check
        const { isCircular } = await checkCircularWikiNesting(doc._id, targetParent._id);
        if (isCircular) {
          return res.status(400).json({
            message: "Cannot move wiki page: circular nesting hierarchy detected",
          });
        }

        doc.parentWikiId = targetParent._id;
      }
    }

    // Designate as Home page (requires managePermissions or Owner role)
    if (isWikiHome !== undefined) {
      if (isWikiHome && !perm.canManagePermissions) {
        return res.status(403).json({
          message: "Forbidden: Only document owners can designate the wiki home page",
        });
      }

      if (isWikiHome) {
        await Document.updateMany(
          { projectId: doc.projectId, isWikiHome: true, _id: { $ne: doc._id } },
          { isWikiHome: false }
        );
        doc.isWikiHome = true;
      } else {
        doc.isWikiHome = false;
      }
    }

    if (wikiOrder !== undefined && Number.isFinite(Number(wikiOrder))) {
      doc.wikiOrder = Number(wikiOrder);
    }

    if (defaultAccess && perm.canManagePermissions && DOCUMENT_ROLES.includes(defaultAccess)) {
      doc.defaultAccess = defaultAccess;
    }

    if (title && title.trim()) {
      doc.title = title.trim();
      doc.wikiSlug = slugifyWikiTitle(doc.title);
    }

    if (content !== undefined) {
      doc.content = sanitizeDocumentJson(content);
    }

    if (contentHtml !== undefined) {
      doc.contentHtml = sanitizeDocumentHtml(contentHtml);
      doc.description = extractPlainTextExcerpt(doc.contentHtml);
    }

    doc.lastUpdatedBy = req.user._id;
    await doc.save();

    // Auto-save snapshot
    await createDocumentVersionSnapshot({
      documentId: doc._id,
      projectId: doc.projectId,
      title: doc.title,
      content: doc.content,
      contentHtml: doc.contentHtml,
      description: doc.description,
      yjsUpdate: doc.yjsUpdate,
      authorId: req.user._id,
      changeSummary: "Wiki page updated",
      force: false,
    });

    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");
    if (doc.parentWikiId) {
      await doc.populate("parentWikiId", "title isWikiHome wikiSlug");
    }
    await doc.populate("shares.userId", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${doc.projectId}`).emit("wikiPageUpdated", doc);
      io.to(`project_${doc.projectId}`).emit("documentUpdated", doc);
    }

    const docObj = doc.toObject();
    docObj.userPermission = await resolveDocumentAccess(doc, req.user._id);
    docObj.breadcrumbs = await getWikiBreadcrumbs(doc._id);

    res.json(docObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Reorders multiple wiki sibling pages within a project in bulk.
 * Payload: { pages: [{ _id, wikiOrder, parentWikiId }] }
 */
export const reorderWikiPages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { pages } = req.body;

    if (!Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ message: "pages array is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to reorganize wiki pages in this project",
      });
    }

    // Process updates
    for (const item of pages) {
      if (!item._id) continue;
      const updateData = {};
      if (Number.isFinite(Number(item.wikiOrder))) {
        updateData.wikiOrder = Number(item.wikiOrder);
      }
      if (item.parentWikiId !== undefined) {
        if (item.parentWikiId === "root" || item.parentWikiId === null || item.parentWikiId === "") {
          updateData.parentWikiId = null;
        } else {
          // Verify circular nesting before reparenting
          const { isCircular } = await checkCircularWikiNesting(item._id, item.parentWikiId);
          if (!isCircular) {
            updateData.parentWikiId = item.parentWikiId;
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        await Document.updateOne(
          { _id: item._id, projectId, isWiki: true },
          { $set: updateData }
        );
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("wikiTreeReordered", { projectId });
    }

    res.json({ message: "Wiki pages reordered successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Deletes a wiki page. If the page has child pages, their `parentWikiId` is safely reparented
 * to the deleted page's parent (or null/root) to prevent orphaned nodes.
 */
export const deleteWikiPage = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findOne({
      _id: documentId,
      isWiki: true,
      isArchived: false,
    });

    if (!doc) return res.status(404).json({ message: "Wiki page not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canDelete) {
      return res.status(403).json({
        message: "Forbidden: Only document owners or team owners can delete this wiki page",
      });
    }

    const projectId = doc.projectId;
    const parentWikiId = doc.parentWikiId;
    const wasHome = doc.isWikiHome;

    // Reparent immediate children to the deleted page's parent
    await Document.updateMany(
      { parentWikiId: doc._id, projectId, isWiki: true },
      { $set: { parentWikiId: parentWikiId } }
    );

    // Delete document
    await doc.deleteOne();

    // If deleted page was Wiki Home, designate another page if available
    if (wasHome) {
      const nextCandidate = await Document.findOne({
        projectId,
        isWiki: true,
        parentWikiId: null,
        isArchived: false,
      }).sort({ wikiOrder: 1, createdAt: 1 });

      if (nextCandidate) {
        nextCandidate.isWikiHome = true;
        await nextCandidate.save();
      }
    }

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Deleted Wiki Page",
      message: `${req.user.name} deleted wiki page "${doc.title}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("wikiPageDeleted", { documentId });
      io.to(`project_${projectId}`).emit("documentDeleted", { documentId });
      io.to(`doc_collab_${documentId}`).emit("collabDocumentDeleted", { documentId });
    }

    res.json({ message: "Wiki page deleted successfully", documentId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
