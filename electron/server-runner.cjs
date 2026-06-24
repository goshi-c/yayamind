const path = require('path');
const { startLocalServer } = require('../dist-server/index.cjs');

process.env.DESKTOP_STATIC_DIR = process.env.DESKTOP_STATIC_DIR || path.join(__dirname, '..', 'dist');

startLocalServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
