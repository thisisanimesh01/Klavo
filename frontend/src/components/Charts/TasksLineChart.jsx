import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

export default function TasksLineChart({ data }) {
  return (
    <Line
      data={{
        labels: data.map((d) => d.day),
        datasets: [
          {
            label: "Tasks Created",
            data: data.map((d) => d.count),
            borderColor: "#4f46e5",
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      }}
    />
  );
}
