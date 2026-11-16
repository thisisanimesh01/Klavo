import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import socket from "../socket";

/**
 * Custom lightweight Yjs Provider that uses the application's existing Socket.IO connection.
 * Synchronizes binary CRDT updates and user awareness/cursors.
 */
export class CollabSocketProvider {
  /**
   * @param {string} documentId
   * @param {Y.Doc} doc
   * @param {object} userInfo - { id, name, email, avatar, color }
   */
  constructor(documentId, doc, userInfo = {}) {
    this.documentId = documentId;
    this.doc = doc;
    this.userInfo = userInfo;
    this.awareness = new Awareness(doc);
    this.connected = false;
    this.onCollaboratorsChange = null;

    // Set initial awareness state for local user
    this.awareness.setLocalStateField("user", {
      name: userInfo.name || "Anonymous",
      color: userInfo.color || "#6366f1",
      avatar: userInfo.avatar || null,
      id: userInfo.id || null,
    });

    // Bound listeners for clean detachment
    this._handleDocSyncInit = this._handleDocSyncInit.bind(this);
    this._handleDocSyncUpdate = this._handleDocSyncUpdate.bind(this);
    this._handleDocUpdate = this._handleDocUpdate.bind(this);
    this._handleCollabUserJoined = this._handleCollabUserJoined.bind(this);
    this._handleCollabUserLeft = this._handleCollabUserLeft.bind(this);
    this._handleCollabCursorMoved = this._handleCollabCursorMoved.bind(this);

    this._init();
  }

  _init() {
    if (!socket.connected) {
      socket.connect();
    }

    // Listen for events from backend
    socket.on("docSyncInit", this._handleDocSyncInit);
    socket.on("docSyncUpdate", this._handleDocSyncUpdate);
    socket.on("collabUserJoined", this._handleCollabUserJoined);
    socket.on("collabUserLeft", this._handleCollabUserLeft);
    socket.on("collabCursorMoved", this._handleCollabCursorMoved);

    // Listen to local doc updates and broadcast to room
    this.doc.on("update", this._handleDocUpdate);

    // Join document collaboration room
    socket.emit("joinDocumentCollab", { documentId: this.documentId });
    this.connected = true;
  }

  _handleDocSyncInit({ documentId, update, collaborators, currentUserColor }) {
    if (documentId !== this.documentId) return;

    if (currentUserColor && this.awareness) {
      const current = this.awareness.getLocalState()?.user || {};
      this.awareness.setLocalStateField("user", {
        ...current,
        color: currentUserColor,
      });
    }

    if (update) {
      try {
        const binary = Uint8Array.from(atob(update), (c) => c.charCodeAt(0));
        Y.applyUpdate(this.doc, binary, "socket-init");
      } catch (err) {
        console.error("Failed to apply initial doc sync update:", err);
      }
    }

    if (this.onCollaboratorsChange && Array.isArray(collaborators)) {
      this.onCollaboratorsChange(collaborators);
    }
  }

  _handleDocSyncUpdate({ documentId, update, senderSocketId }) {
    if (documentId !== this.documentId) return;
    if (senderSocketId === socket.id) return; // Ignore own echo

    try {
      const binary = Uint8Array.from(atob(update), (c) => c.charCodeAt(0));
      Y.applyUpdate(this.doc, binary, "socket-remote");
    } catch (err) {
      console.error("Failed to apply remote doc update:", err);
    }
  }

  _handleDocUpdate(update, origin) {
    // Only send locally initiated transactions (not incoming socket updates)
    if (origin === "socket-init" || origin === "socket-remote") return;

    try {
      let binaryString = "";
      const len = update.byteLength;
      for (let i = 0; i < len; i++) {
        binaryString += String.fromCharCode(update[i]);
      }
      const base64Update = btoa(binaryString);

      socket.emit("docSyncUpdate", {
        documentId: this.documentId,
        update: base64Update,
      });
    } catch (err) {
      console.error("Failed to broadcast local doc update:", err);
    }
  }

  _handleCollabUserJoined(collaborator) {
    if (this.onCollaboratorsChange) {
      this.onCollaboratorsChange((prev) => {
        if (!Array.isArray(prev)) return [collaborator];
        if (prev.some((c) => c.socketId === collaborator.socketId)) return prev;
        return [...prev, collaborator];
      });
    }
  }

  _handleCollabUserLeft({ socketId, remainingCollaborators }) {
    if (this.onCollaboratorsChange) {
      if (Array.isArray(remainingCollaborators)) {
        this.onCollaboratorsChange(remainingCollaborators);
      } else {
        this.onCollaboratorsChange((prev) =>
          Array.isArray(prev) ? prev.filter((c) => c.socketId !== socketId) : []
        );
      }
    }
  }

  _handleCollabCursorMoved(data) {
    // Awareness handles cursors through the CollaborationCursor extension
  }

  destroy() {
    this.connected = false;

    // Leave document collaboration room
    socket.emit("leaveDocumentCollab", { documentId: this.documentId });

    // Detach socket listeners
    socket.off("docSyncInit", this._handleDocSyncInit);
    socket.off("docSyncUpdate", this._handleDocSyncUpdate);
    socket.off("collabUserJoined", this._handleCollabUserJoined);
    socket.off("collabUserLeft", this._handleCollabUserLeft);
    socket.off("collabCursorMoved", this._handleCollabCursorMoved);

    // Detach doc listeners
    this.doc.off("update", this._handleDocUpdate);
    this.awareness.destroy();
  }
}
