import { createApp } from './app';

const app = createApp();

// In Vercel serverless, we don't need http.createServer() or Socket.IO.
// Those are only for the local dev/standalone server.
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Dynamic import to avoid loading socket.io in serverless
  import('http').then(http => {
    const server = http.createServer(app);

    import('./modules/notifications/socket.service').then(({ socketService }) => {
      try {
        socketService.init(server);
      } catch (err) {
        console.warn('Socket service init warning:', err);
      }
    }).catch(err => {
      console.warn('Socket service import warning:', err);
    });

    import('./config').then(({ config }) => {
      server.listen(config.PORT, () => {
        console.log(`Helpdesk server running on port ${config.PORT} [env: ${config.NODE_ENV}, auth: ${config.AUTH_MODE}]`);
      });
    });
  });
}

export default app;
