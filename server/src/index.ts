import http from 'http';
import dotenv from 'dotenv';
import app, { setupWebSocketServer } from './app';

dotenv.config();

const port = process.env.PORT || 3000;

// Setup HTTP Server & attach WebSocket Event Bus
const server = http.createServer(app);
setupWebSocketServer(server);

// Start Server
server.listen(port, () => {
  console.log(`=================================================`);
  console.log(`🚀 Omnigent Server is running on port ${port}`);
  console.log(`📡 WebSocket Event Bus is listening...`);
  console.log(`=================================================`);
});
