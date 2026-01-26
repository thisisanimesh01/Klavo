import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale);

export default function StatusBarChart({ data }) {
  return (
    <Bar
      data={{
        labels: ["Todo", "In Progress", "Done"],
        datasets: [
          {
            data: [data.todo || 0, data.progress || 0, data.done || 0],
            backgroundColor: ["#64748b", "#4f46e5", "#10b981"],
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
      }}
    />
  );
}
