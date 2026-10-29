const events = require('events');
events.defaultMaxListeners = 50;
if (process.setMaxListeners) {
  process.setMaxListeners(50);
}

const fs = require('fs');
const path = require('path');

// Set the port
process.env.PORT = process.env.PORT || 3000;

// Boot the standalone server compiled by Next.js
const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');
const nestedServer = path.join(__dirname, '.next', 'standalone', 'frontend', 'server.js');

if (fs.existsSync(standaloneServer)) {
  require(standaloneServer);
} else if (fs.existsSync(nestedServer)) {
  require(nestedServer);
} else {
  // Try fallback to any server.js inside .next/standalone
  const standaloneDir = path.join(__dirname, '.next', 'standalone');
  if (fs.existsSync(standaloneDir)) {
    const findServer = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === 'server.js') return full;
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const res = findServer(full);
          if (res) return res;
        }
      }
      return null;
    };
    const found = findServer(standaloneDir);
    if (found) {
      require(found);
    } else {
      console.error('Could not find server.js inside .next/standalone');
    }
  }
}
