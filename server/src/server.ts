import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { socketService } from './modules/notifications/socket.service';

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO safely (ephemeral serverless runtimes don't keep persistent WS)
try {
  socketService.init(server);
} catch (err) {
  console.warn('Socket service init warning:', err);
}

// Only listen directly when running as a standalone node server (not in Vercel serverless)
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  server.listen(config.PORT, () => {
    console.log(`Helpdesk server running on port ${config.PORT} [env: ${config.NODE_ENV}, auth: ${config.AUTH_MODE}]`);
  });
}

export default app;
