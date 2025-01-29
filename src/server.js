require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS.split(','),
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.PORT || 3000;

// Enable CORS for REST endpoints
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Store active rooms and their participants
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle room joining
  socket.on('join', (data) => {
    const { room } = data;

    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }

    rooms.get(room).add(socket.id);
    socket.join(room);

    socket.to(room).emit('user-joined', { id: socket.id });

    const existingUsers = Array.from(rooms.get(room)).filter(id => id !== socket.id);
    socket.emit('existing-users', { users: existingUsers });

    console.log(`User ${socket.id} joined room ${room}`);
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.to).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.to).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    rooms.forEach((participants, room) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        socket.to(room).emit('user-left', { id: socket.id });

        if (participants.size === 0) {
          rooms.delete(room);
        }
      }
    });
    console.log('User disconnected:', socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});