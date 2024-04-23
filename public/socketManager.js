import io from "socket.io-client";

const socket = io("https://rooks-move.vercel.app/");

export default socket;
