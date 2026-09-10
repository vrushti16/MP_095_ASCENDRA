const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = require('./app');
const { connectRedis, disconnectRedis } = require('./config/redis');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 ASCENDRA Game Backend Server Started!`);
  console.log(`📡 Environment: ${NODE_ENV}`);
  console.log(`🔗 Port:        ${PORT}`);
  console.log(`🩺 Health API:  http://localhost:${PORT}/api/v1/health`);
  console.log(`===============================================`);

  // Connect Redis cache gracefully (never blocks or crashes server if offline)
  await connectRedis();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down gracefully...', err);
  server.close(async () => {
    await disconnectRedis();
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down immediately...', err);
  process.exit(1);
});

// Graceful shutdown on termination signals
const handleShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Gracefully terminating ASCENDRA backend...`);
  await disconnectRedis();
  server.close(() => {
    console.log('✅ HTTP server closed. Process terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = server;
