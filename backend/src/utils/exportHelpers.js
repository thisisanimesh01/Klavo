/**
 * Export helpers for CSV and PDF generation (ANL-07).
 *
 * Implements strict security:
 * 1. CSV Formula Injection prevention (neutralizes '=', '+', '-', '@', '\t', '\r' prefixes).
 * 2. Proper RFC 4180 CSV escaping (double-quoting, newline handling, comma escaping).
 * 3. High-quality standards-compliant pure PDF generator with metadata headers,
 *    page numbering, summary cards, and tabular layouts.
 * 4. Zero fabrication guarantee: Never invents numbers or historical records.
 *    Estimated hours and story points are strictly kept separate.
 */

/**
 * Escapes a single CSV cell value according to RFC 4180 and protects against CSV Formula Injection.
 *
 * Spreadsheet Formula Injection occurs when cells starting with '=', '+', '-', '@', '\t', '\r'
 * are executed by Excel, Google Sheets, or LibreOffice Calc.
 * We neutralize this by prefixing such cells with a single quote (') before quoting.
 */
export const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // CSV Formula Injection mitigation:
  // If the cell begins with formula trigger characters, prepend with single quote
  const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
  if (str.length > 0 && formulaChars.includes(str.charAt(0))) {
    str = "'" + str;
  }

  // RFC 4180: If value contains quotes, commas, newlines, or carriage returns, wrap in quotes and escape quotes with ""
  if (/[",\n\r]/.test(str) || str.startsWith("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return `"${str}"`;
};

/**
 * Converts a 2D array of rows into an RFC 4180 compliant CSV string.
 */
export const buildCsvString = (rows = []) => {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
};

/**
 * Generates standard Klavo CSV export content including standard metadata banner,
 * metric definitions, group summary, and detailed task records.
 */
export const generateReportCsv = ({
  reportTitle = "Analytics Report",
  projectName = "Project",
  generatedAt = new Date().toISOString(),
  dateRange = "All Time",
  metricDefinitions = [],
  groups = [],
  tasks = [],
}) => {
  const rows = [];

  // Metadata block
  rows.push(["KLAVO ANALYTICS REPORT EXPORT"]);
  rows.push(["Report Title", reportTitle]);
  rows.push(["Project", projectName]);
  rows.push(["Exported At", generatedAt]);
  rows.push(["Date Range", dateRange]);
  rows.push([]);

  // Metric definitions block
  if (metricDefinitions.length > 0) {
    rows.push(["METRIC DEFINITIONS & NOTES"]);
    metricDefinitions.forEach((def) => rows.push(["Note", def]));
    rows.push([]);
  }

  // Summary groups block
  if (groups.length > 0) {
    rows.push(["GROUP SUMMARY BREAKDOWN"]);
    rows.push([
      "Group Dimension",
      "Task Count",
      "Completion Rate (%)",
      "Total Estimated Hours",
      "Total Story Points",
      "Overdue Tasks",
    ]);
    groups.forEach((g) => {
      rows.push([
        g.groupLabel || "Unassigned",
        g.count ?? 0,
        g.completionRate !== undefined && g.completionRate !== null ? `${g.completionRate}%` : "0%",
        g.totalEstimatedHours ?? 0,
        g.totalStoryPoints ?? 0,
        g.overdueCount ?? 0,
      ]);
    });
    rows.push([]);
  }

  // Detailed tasks block
  rows.push(["TASK RECORDS", `Total Records: ${tasks.length}`]);
  rows.push([
    "Task ID",
    "Title",
    "Status",
    "Priority",
    "Assignee Name",
    "Assignee Email",
    "Sprint",
    "Milestone",
    "Due Date",
    "Estimated Hours",
    "Story Points",
    "Created Date",
    "Completed Date",
  ]);

  tasks.forEach((t) => {
    rows.push([
      t._id ? String(t._id) : "",
      t.title || "Untitled Task",
      t.status || "todo",
      t.priority || "medium",
      t.assigneeName || (t.assignedTo?.name ? t.assignedTo.name : "Unassigned"),
      t.assigneeEmail || (t.assignedTo?.email ? t.assignedTo.email : ""),
      t.sprintName || (t.sprintId?.name ? t.sprintId.name : ""),
      t.milestoneName || (t.milestoneId?.name ? t.milestoneId.name : ""),
      t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "",
      t.estimatedHours !== null && t.estimatedHours !== undefined ? t.estimatedHours : "",
      t.storyPoints !== null && t.storyPoints !== undefined ? t.storyPoints : "",
      t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : "",
      t.completedAt ? new Date(t.completedAt).toISOString().slice(0, 10) : "",
    ]);
  });

  return buildCsvString(rows);
};

/**
 * Sanitizes plain text for standard PDF string literal encoding.
 * Escapes backslashes and parentheses.
 */
export const sanitizePdfText = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n\t]/g, " ");
};

/**
 * Pure, self-contained PDF document generator.
 *
 * Produces clean, standards-compliant PDF 1.4 binary Buffers without any external runtime dependencies.
 * Includes header banners, metadata, summary statistics, styled data tables, and dynamic page numbering ("Page X of Y").
 */
export const generateReportPdf = ({
  reportTitle = "Analytics Report",
  projectName = "Project",
  generatedAt = new Date().toISOString(),
  dateRange = "All Time",
  metricDefinitions = [],
  groups = [],
  tasks = [],
}) => {
  const pages = [];
  let currentPageCommands = [];

  const startNewPage = (isFirstPage = false) => {
    if (currentPageCommands.length > 0) {
      pages.push(currentPageCommands.join("\n"));
    }
    currentPageCommands = [];

    // Header banner on top of every page
    currentPageCommands.push("0.06 0.09 0.16 rg"); // Slate-900 background #0F172A
    currentPageCommands.push("0 752 595 90 re f");

    // Title & subtitle
    currentPageCommands.push("1 1 1 rg"); // White text
    const displayTitle = (reportTitle || "Klavo Analytics Report").slice(0, 50);
    currentPageCommands.push(`BT /F2 15 Tf 36 805 Td (${sanitizePdfText(displayTitle)}) Tj ET`);

    currentPageCommands.push("0.60 0.65 0.75 rg"); // Slate-400 subtitle
    const metaLine1 = `Project: ${projectName}  |  Generated: ${new Date(generatedAt).toISOString().slice(0, 19).replace("T", " ")} UTC`;
    currentPageCommands.push(`BT /F1 8.5 Tf 36 788 Td (${sanitizePdfText(metaLine1.slice(0, 85))}) Tj ET`);

    const metaLine2 = `Date Range: ${dateRange}  |  Klavo Project Intelligence`;
    currentPageCommands.push(`BT /F1 8.5 Tf 36 772 Td (${sanitizePdfText(metaLine2.slice(0, 85))}) Tj ET`);

    // Reset default text fill color
    currentPageCommands.push("0.1 0.1 0.1 rg");
  };

  const drawText = (text, xPos, yPos, font = "F1", size = 8.5, color = [0.1, 0.1, 0.1]) => {
    currentPageCommands.push(`${color.join(" ")} rg`);
    currentPageCommands.push(`BT /${font} ${size} Tf ${xPos} ${yPos} Td (${sanitizePdfText(text)}) Tj ET`);
  };

  const drawRow = (cols, xPosList, yPos, font = "F1", size = 7.5, color = [0.15, 0.15, 0.15], bgColor = null) => {
    if (bgColor) {
      currentPageCommands.push(`${bgColor.join(" ")} rg`);
      currentPageCommands.push(`36 ${yPos - 3} 523 13.5 re f`);
    }
    cols.forEach((col, idx) => {
      drawText(String(col), xPosList[idx], yPos, font, size, color);
    });
  };

  startNewPage(true);
  let y = 730;

  // Metric Definitions
  if (metricDefinitions && metricDefinitions.length > 0) {
    drawText("Metric Definitions & Disclosures:", 36, y, "F2", 9, [0.06, 0.09, 0.16]);
    y -= 13;
    metricDefinitions.slice(0, 4).forEach((def) => {
      drawText(`• ${def}`.slice(0, 105), 44, y, "F1", 7.5, [0.35, 0.4, 0.45]);
      y -= 11;
    });
    y -= 8;
  }

  // Summary Groups
  if (groups && groups.length > 0) {
    drawText(`Group Summary (${groups.length} segments)`, 36, y, "F2", 9.5, [0.06, 0.09, 0.16]);
    y -= 13;

    const groupColX = [40, 180, 260, 350, 440];
    drawRow(
      ["Group Dimension", "Task Count", "Completion", "Est. Hours", "Story Points"],
      groupColX,
      y,
      "F2",
      7.5,
      [1, 1, 1],
      [0.2, 0.25, 0.35]
    );
    y -= 15;

    groups.forEach((g, idx) => {
      if (y < 55) {
        startNewPage();
        y = 730;
        drawRow(
          ["Group Dimension", "Task Count", "Completion", "Est. Hours", "Story Points"],
          groupColX,
          y,
          "F2",
          7.5,
          [1, 1, 1],
          [0.2, 0.25, 0.35]
        );
        y -= 15;
      }
      const bg = idx % 2 === 0 ? [0.96, 0.97, 0.98] : [1, 1, 1];
      drawRow(
        [
          (g.groupLabel || "Unassigned").slice(0, 24),
          String(g.count ?? 0),
          `${g.completionRate ?? 0}%`,
          `${g.totalEstimatedHours ?? 0} hrs`,
          `${g.totalStoryPoints ?? 0} pts`,
        ],
        groupColX,
        y,
        "F1",
        7.5,
        [0.15, 0.15, 0.15],
        bg
      );
      y -= 13;
    });
    y -= 14;
  }

  // Detailed Tasks Table
  if (tasks && tasks.length > 0) {
    if (y < 85) {
      startNewPage();
      y = 730;
    }

    drawText(`Task Detail Records (${tasks.length} items)`, 36, y, "F2", 9.5, [0.06, 0.09, 0.16]);
    y -= 13;

    const taskColX = [40, 210, 280, 355, 435, 495];
    const taskHeaders = ["Task Title", "Status", "Priority", "Assignee", "Due Date", "Est / Pts"];

    drawRow(taskHeaders, taskColX, y, "F2", 7.5, [1, 1, 1], [0.2, 0.25, 0.35]);
    y -= 15;

    tasks.forEach((t, idx) => {
      if (y < 50) {
        startNewPage();
        y = 730;
        drawRow(taskHeaders, taskColX, y, "F2", 7.5, [1, 1, 1], [0.2, 0.25, 0.35]);
        y -= 15;
      }

      const bg = idx % 2 === 0 ? [0.97, 0.98, 0.99] : [1, 1, 1];
      const estStr = t.estimatedHours !== null && t.estimatedHours !== undefined ? `${t.estimatedHours}h` : "";
      const ptsStr = t.storyPoints !== null && t.storyPoints !== undefined ? `${t.storyPoints}p` : "";
      const combinedWork = estStr && ptsStr ? `${estStr} / ${ptsStr}` : estStr || ptsStr || "-";

      const assignee = t.assigneeName || (t.assignedTo?.name ? t.assignedTo.name : "Unassigned");
      const dueDateStr = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "-";

      drawRow(
        [
          (t.title || "Untitled").slice(0, 30),
          (t.status || "todo").slice(0, 12),
          (t.priority || "medium").slice(0, 10),
          assignee.slice(0, 14),
          dueDateStr,
          combinedWork,
        ],
        taskColX,
        y,
        "F1",
        7,
        [0.15, 0.15, 0.15],
        bg
      );
      y -= 12.5;
    });
  } else if (!groups || groups.length === 0) {
    drawText("No task records or group dimensions match the specified report filters.", 36, y, "F1", 9, [0.5, 0.5, 0.5]);
  }

  // Push final page commands
  if (currentPageCommands.length > 0) {
    pages.push(currentPageCommands.join("\n"));
  }

  // Finalize pages with bottom page numbers
  const totalPages = pages.length;
  const finalizedPageStreams = pages.map((content, idx) => {
    const pageNumText = `Page ${idx + 1} of ${totalPages}`;
    const footerCmd = `0.5 0.5 0.5 rg\nBT /F1 8 Tf 265 20 Td (${sanitizePdfText(pageNumText)}) Tj ET`;
    return `${content}\n${footerCmd}`;
  });

  // Assemble PDF document objects
  const catalogObjNum = 1;
  const pagesObjNum = 2;
  const f1ObjNum = 3;
  const f2ObjNum = 4;

  const pageObjNums = [];
  finalizedPageStreams.forEach((_, i) => {
    pageObjNums.push(5 + 2 * i);
  });

  const bodyParts = [];
  bodyParts.push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const xrefOffsets = [];

  const addSerializedObject = (objNum, body) => {
    xrefOffsets[objNum] = Buffer.byteLength(bodyParts.join(""), "utf8");
    bodyParts.push(`${objNum} 0 obj\n${body}\nendobj\n`);
  };

  // 1: Catalog
  addSerializedObject(catalogObjNum, `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);
  // 2: Pages root
  addSerializedObject(
    pagesObjNum,
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjNums.length} >>`
  );
  // 3: Font F1 (Helvetica)
  addSerializedObject(f1ObjNum, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // 4: Font F2 (Helvetica-Bold)
  addSerializedObject(f2ObjNum, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  // Add each page and stream object
  finalizedPageStreams.forEach((streamContent, i) => {
    const pNum = 5 + 2 * i;
    const cNum = 6 + 2 * i;
    const pageBody = `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 595 842] /Contents ${cNum} 0 R /Resources << /Font << /F1 ${f1ObjNum} 0 R /F2 ${f2ObjNum} 0 R >> >> >>`;
    addSerializedObject(pNum, pageBody);

    const streamLen = Buffer.byteLength(streamContent, "utf8");
    const contentBody = `<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream`;
    addSerializedObject(cNum, contentBody);
  });

  const startXref = Buffer.byteLength(bodyParts.join(""), "utf8");
  const totalObjCount = 4 + 2 * finalizedPageStreams.length + 1;

  let xrefStr = `xref\n0 ${totalObjCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < totalObjCount; i++) {
    const offset = String(xrefOffsets[i] || 0).padStart(10, "0");
    xrefStr += `${offset} 00000 n \n`;
  }

  const trailerStr = `trailer\n<< /Size ${totalObjCount} /Root ${catalogObjNum} 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  bodyParts.push(xrefStr + trailerStr);
  return Buffer.from(bodyParts.join(""), "utf8");
};
