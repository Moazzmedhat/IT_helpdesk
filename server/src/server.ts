import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { socketService } from './modules/notifications/socket.service';

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO
socketService.init(server);

// Only listen directly when not running in a serverless environment (e.g. Vercel)
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  server.listen(config.PORT, () => {
    console.log(`Helpdesk server running on port ${config.PORT} [env: ${config.NODE_ENV}, auth: ${config.AUTH_MODE}]`);
  });
}

export default app;
