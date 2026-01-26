import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5050";

// create socket but don't auto connect, so we can join user room only when we have user id
const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

export default socket;
