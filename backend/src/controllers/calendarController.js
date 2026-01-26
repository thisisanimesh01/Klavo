import Task from "../models/Task.js";

export const getCalendarTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedTo: req.user._id,
      dueDate: { $ne: null }
    }).sort({ dueDate: 1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
