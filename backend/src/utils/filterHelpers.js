import mongoose from "mongoose";

/**
 * Builds a robust MongoDB query object from incoming search & filter parameters.
 * Supports title, description, label search, multi-status, multi-priority,
 * assignees, sprint, milestone, parent hierarchy, due dates, dependencies, and custom fields.
 *
 * @param {string|ObjectId} projectId
 * @param {object} params
 * @param {string|ObjectId} currentUserId
 * @returns {object} MongoDB query object
 */
export const buildTaskFilterQuery = (projectId, params = {}, currentUserId = null) => {
  const query = { projectId: new mongoose.Types.ObjectId(projectId) };

  // 1. Text Search across Title, Description, and Labels
  if (params.search && typeof params.search === "string" && params.search.trim()) {
    const rawSearch = params.search.trim();
    // Escape special regex characters
    const escaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    query.$or = [
      { title: regex },
      { description: regex },
      { "labels.name": regex },
    ];
  }

  // 2. Status / Multi-Status Filter
  if (params.statuses) {
    const statusList = Array.isArray(params.statuses)
      ? params.statuses
      : typeof params.statuses === "string"
      ? params.statuses.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    if (statusList.length > 0 && !statusList.includes("all")) {
      query.status = { $in: statusList };
    }
  } else if (params.status && params.status !== "all") {
    query.status = params.status;
  }

  // 3. Priority / Multi-Priority Filter
  if (params.priorities) {
    const priorityList = Array.isArray(params.priorities)
      ? params.priorities
      : typeof params.priorities === "string"
      ? params.priorities.split(",").map((p) => p.trim()).filter(Boolean)
      : [];
    if (priorityList.length > 0 && !priorityList.includes("all")) {
      query.priority = { $in: priorityList };
    }
  } else if (params.priority && params.priority !== "all") {
    query.priority = params.priority;
  }

  // 4. Assignee / Multi-Assignee Filter
  if (params.assignees) {
    const assigneeList = Array.isArray(params.assignees)
      ? params.assignees
      : typeof params.assignees === "string"
      ? params.assignees.split(",").map((a) => a.trim()).filter(Boolean)
      : [];

    if (assigneeList.length > 0 && !assigneeList.includes("all")) {
      const orConditions = [];

      const validObjectIds = [];
      for (const a of assigneeList) {
        if (a === "unassigned") {
          orConditions.push({ assignedTo: { $size: 0 } });
          orConditions.push({ assignedTo: { $exists: false } });
        } else if (a === "me" && currentUserId) {
          validObjectIds.push(new mongoose.Types.ObjectId(currentUserId));
        } else if (mongoose.Types.ObjectId.isValid(a)) {
          validObjectIds.push(new mongoose.Types.ObjectId(a));
        }
      }

      if (validObjectIds.length > 0) {
        orConditions.push({ assignedTo: { $in: validObjectIds } });
      }

      if (orConditions.length === 1) {
        Object.assign(query, orConditions[0]);
      } else if (orConditions.length > 1) {
        if (!query.$and) query.$and = [];
        query.$and.push({ $or: orConditions });
      }
    }
  } else if (params.assignedTo && params.assignedTo !== "all") {
    if (params.assignedTo === "unassigned") {
      query.$or = [{ assignedTo: { $size: 0 } }, { assignedTo: { $exists: false } }];
    } else if (params.assignedTo === "me" && currentUserId) {
      query.assignedTo = new mongoose.Types.ObjectId(currentUserId);
    } else if (mongoose.Types.ObjectId.isValid(params.assignedTo)) {
      query.assignedTo = new mongoose.Types.ObjectId(params.assignedTo);
    }
  }

  // 5. Labels / Multi-Label Filter
  if (params.labels) {
    const labelList = Array.isArray(params.labels)
      ? params.labels
      : typeof params.labels === "string"
      ? params.labels.split(",").map((l) => l.trim()).filter(Boolean)
      : [];
    if (labelList.length > 0 && !labelList.includes("all")) {
      const labelRegexes = labelList.map(
        (l) => new RegExp(`^${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
      );
      query["labels.name"] = { $in: labelRegexes };
    }
  } else if (params.label && params.label !== "all") {
    const escaped = params.label.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query["labels.name"] = { $regex: new RegExp(`^${escaped}$`, "i") };
  }

  // 6. Sprint Filter
  if (params.sprintId !== undefined) {
    if (params.sprintId === "backlog" || params.sprintId === "null" || params.sprintId === "") {
      query.sprintId = null;
    } else if (params.sprintId !== "all" && mongoose.Types.ObjectId.isValid(params.sprintId)) {
      query.sprintId = new mongoose.Types.ObjectId(params.sprintId);
    }
  }

  // 7. Milestone Filter
  if (params.milestoneId !== undefined) {
    if (params.milestoneId === "none" || params.milestoneId === "null" || params.milestoneId === "") {
      query.milestoneId = null;
    } else if (params.milestoneId !== "all" && mongoose.Types.ObjectId.isValid(params.milestoneId)) {
      query.milestoneId = new mongoose.Types.ObjectId(params.milestoneId);
    }
  }

  // 8. Parent / Subtask Hierarchy Filter
  if (params.parentId !== undefined) {
    if (params.parentId === "null" || params.parentId === "" || params.parentId === "top-level") {
      query.parentId = null;
    } else if (params.parentId !== "all" && mongoose.Types.ObjectId.isValid(params.parentId)) {
      query.parentId = new mongoose.Types.ObjectId(params.parentId);
    }
  }

  // 9. Due Date Filter
  if (params.dueDateFilter && params.dueDateFilter !== "all") {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    if (params.dueDateFilter === "overdue") {
      query.dueDate = { $ne: null, $lt: startOfToday };
    } else if (params.dueDateFilter === "today") {
      query.dueDate = { $gte: startOfToday, $lte: endOfToday };
    } else if (params.dueDateFilter === "this_week") {
      const dayOfWeek = now.getDay(); // 0 is Sunday
      const diffToMonday = (dayOfWeek + 6) % 7;
      const startOfWeek = new Date(startOfToday.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      query.dueDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (params.dueDateFilter === "next_week") {
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const startOfNextWeek = new Date(startOfToday.getTime() + (7 - diffToMonday) * 24 * 60 * 60 * 1000);
      const endOfNextWeek = new Date(startOfNextWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      query.dueDate = { $gte: startOfNextWeek, $lte: endOfNextWeek };
    } else if (params.dueDateFilter === "no_due_date") {
      query.$or = [{ dueDate: null }, { dueDate: { $exists: false } }];
    }
  }

  // 10. Dependency Filter
  if (params.dependencyFilter && params.dependencyFilter !== "all") {
    if (params.dependencyFilter === "has_dependencies") {
      query.dependencies = { $exists: true, $not: { $size: 0 } };
    } else if (params.dependencyFilter === "no_dependencies") {
      query.$or = [{ dependencies: { $size: 0 } }, { dependencies: { $exists: false } }];
    } else if (params.dependencyFilter === "blocked_only") {
      query.dependencies = { $elemMatch: { type: "blocked-by" } };
    } else if (params.dependencyFilter === "unblocked_only") {
      query["dependencies.type"] = { $ne: "blocked-by" };
    }
  }

  // 11. Custom Field Filters
  if (Array.isArray(params.customFieldFilters) && params.customFieldFilters.length > 0) {
    for (const cf of params.customFieldFilters) {
      if (!cf.name) continue;
      const fieldElem = { name: cf.name };
      if (cf.operator === "equals" && cf.value !== undefined) {
        fieldElem.value = cf.value;
      } else if (cf.operator === "contains" && typeof cf.value === "string") {
        fieldElem.value = new RegExp(cf.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      } else if (cf.operator === "exists" || cf.operator === "not_empty") {
        fieldElem.value = { $ne: null, $exists: true };
      }
      if (!query.customFields) {
        query.customFields = { $elemMatch: fieldElem };
      } else {
        if (!query.$and) query.$and = [];
        query.$and.push({ customFields: { $elemMatch: fieldElem } });
      }
    }
  }

  return query;
};

/**
 * Builds MongoDB sort specification from sortBy and sortOrder parameters.
 */
export const buildTaskSortConfig = (sortBy = "order", sortOrder = "asc") => {
  const direction = sortOrder === "desc" ? -1 : 1;

  switch (sortBy) {
    case "priority": {
      // Return order specification or handled in application logic
      return { priority: direction, order: 1 };
    }
    case "dueDate": {
      return { dueDate: direction, order: 1 };
    }
    case "createdAt": {
      return { createdAt: direction };
    }
    case "updatedAt": {
      return { updatedAt: direction };
    }
    case "title": {
      return { title: direction };
    }
    case "estimatedHours": {
      return { estimatedHours: direction, order: 1 };
    }
    case "order":
    default:
      return { status: 1, order: 1, createdAt: 1 };
  }
};
