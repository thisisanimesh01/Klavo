import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },

    // task status
    status: {
      type: String,
      enum: ["todo", "in-progress", "review", "done"],
      default: "todo"
    },


    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },


    dueDate: {
      type: Date,
      default: null
    },


    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],


    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      }
    ],


    order: {
      type: Number,
      default: 0
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
