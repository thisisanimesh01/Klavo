import React, { useState } from "react";
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  CornerDownRight,
  Trash2,
  Edit2,
  Check,
  X,
  AtSign,
  Quote,
  Filter,
} from "lucide-react";

export default function DocumentCommentsPanel({
  isOpen,
  onClose,
  comments = [],
  onCreateComment,
  onResolveComment,
  onDeleteComment,
  onEditComment,
  projectTeamMembers = [],
  currentUser,
  canComment = true,
  isOwner = false,
  activeAnchor = null,
  onClearActiveAnchor,
}) {
  const [newCommentText, setNewCommentText] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'open' | 'resolved'
  const [mentionQuery, setMentionQuery] = useState(null);

  if (!isOpen) return null;

  // Filter threads
  const filteredThreads = comments.filter((thread) => {
    if (filterMode === "open") return !thread.isResolved;
    if (filterMode === "resolved") return thread.isResolved;
    return true;
  });

  // Handle submitting top-level comment (inline or general)
  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !canComment) return;

    onCreateComment({
      text: newCommentText.trim(),
      anchor: activeAnchor || null,
    });

    setNewCommentText("");
    if (onClearActiveAnchor) onClearActiveAnchor();
  };

  // Handle submitting threaded reply
  const handleSubmitReply = (parentCommentId) => {
    if (!replyText.trim() || !canComment) return;

    onCreateComment({
      text: replyText.trim(),
      parentCommentId,
    });

    setReplyText("");
    setReplyingToId(null);
  };

  // Handle inline mention selection
  const handleSelectMention = (memberName, isReply = false) => {
    if (isReply) {
      setReplyText((prev) => prev.replace(/@\w*$/, `@${memberName} `));
    } else {
      setNewCommentText((prev) => prev.replace(/@\w*$/, `@${memberName} `));
    }
    setMentionQuery(null);
  };

  return (
    <div className="fixed md:static inset-y-0 right-0 z-40 md:z-auto w-full sm:w-88 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shadow-2xl md:shadow-lg shrink-0">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Discussions
          </h3>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Filter dropdown */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 border border-transparent focus:outline-hidden cursor-pointer"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Anchor Banner (if user selected text to comment on) */}
      {activeAnchor && activeAnchor.selectedText && (
        <div className="p-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex items-start justify-between gap-2 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
              <Quote className="w-3 h-3" />
              Commenting on selection:
            </span>
            <p className="text-[11px] italic text-slate-700 dark:text-slate-300 line-clamp-2 border-l-2 border-indigo-400 pl-2">
              "{activeAnchor.selectedText}"
            </p>
          </div>
          <button
            onClick={onClearActiveAnchor}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Cancel selection anchor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredThreads.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-xs">
              {filterMode === "resolved"
                ? "No resolved comments."
                : "No comments yet. Start a discussion!"}
            </p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isThreadAuthor = thread.userId?._id === currentUser?._id;
            const canManageThis = isThreadAuthor || isOwner;

            return (
              <div
                key={thread._id}
                className={`p-3 rounded-2xl border transition space-y-2.5 ${
                  thread.isResolved
                    ? "bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/50 opacity-75"
                    : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 shadow-xs"
                }`}
              >
                {/* Inline Quote Anchor if present */}
                {thread.anchor?.selectedText && (
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border-l-2 border-indigo-500 text-[11px] italic text-slate-600 dark:text-slate-300">
                    "{thread.anchor.selectedText}"
                  </div>
                )}

                {/* Comment Author Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {thread.userId?.name ? thread.userId.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        {thread.userId?.name || "User"}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(thread.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Resolve / Delete / Edit */}
                  <div className="flex items-center gap-1">
                    {canComment && (
                      <button
                        onClick={() => onResolveComment(thread._id, !thread.isResolved)}
                        className={`p-1 rounded-lg text-xs transition ${
                          thread.isResolved
                            ? "text-emerald-600 hover:text-slate-500"
                            : "text-slate-400 hover:text-emerald-600"
                        }`}
                        title={thread.isResolved ? "Reopen thread" : "Resolve thread"}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}

                    {canManageThis && (
                      <button
                        onClick={() => onDeleteComment(thread._id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition"
                        title="Delete thread"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment Body */}
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {thread.text}
                </p>

                {/* Threaded Replies */}
                {thread.replies && thread.replies.length > 0 && (
                  <div className="pt-2 pl-3 border-l-2 border-slate-100 dark:border-slate-700/60 space-y-2">
                    {thread.replies.map((reply) => {
                      const isReplyAuthor = reply.userId?._id === currentUser?._id;
                      const canManageReply = isReplyAuthor || isOwner;

                      return (
                        <div key={reply._id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                {reply.userId?.name || "User"}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {canManageReply && (
                              <button
                                onClick={() => onDeleteComment(reply._id)}
                                className="text-slate-400 hover:text-red-500"
                                title="Delete reply"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300">
                            {reply.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply Form */}
                {canComment && !thread.isResolved && (
                  <div className="pt-1.5">
                    {replyingToId === thread._id ? (
                      <div className="space-y-1.5">
                        <textarea
                          rows={2}
                          placeholder="Write a reply... (@mention teammate)"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToId(null);
                              setReplyText("");
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitReply(thread._id)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold rounded-lg shadow-xs"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyingToId(thread._id);
                          setReplyText("");
                        }}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>Reply</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Input Box (Footer) */}
      {canComment ? (
        <form onSubmit={handleSubmitComment} className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="relative">
            <textarea
              rows={2}
              placeholder="Add a comment... (Type @ to mention)"
              value={newCommentText}
              onChange={(e) => {
                const val = e.target.value;
                setNewCommentText(val);
                const lastWord = val.split(/\s+/).pop();
                if (lastWord && lastWord.startsWith("@")) {
                  setMentionQuery(lastWord.slice(1).toLowerCase());
                } else {
                  setMentionQuery(null);
                }
              }}
              className="w-full p-2.5 pr-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden resize-none"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="absolute right-2.5 bottom-3.5 p-1 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 rounded-lg shadow-xs transition"
              title="Post comment"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mention autocomplete dropdown */}
          {mentionQuery !== null && (
            <div className="p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl max-h-32 overflow-y-auto space-y-0.5">
              {projectTeamMembers
                .filter((m) => m.name.toLowerCase().includes(mentionQuery))
                .slice(0, 5)
                .map((member) => (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => handleSelectMention(member.name)}
                    className="w-full flex items-center gap-2 p-1.5 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-slate-800 dark:text-slate-200"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{member.name}</span>
                  </button>
                ))}
            </div>
          )}
        </form>
      ) : (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
          You have view-only access and cannot post comments.
        </div>
      )}
    </div>
  );
}
