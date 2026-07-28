FROM node:22-alpine

WORKDIR /app

# Install deps first so a code-only change does not re-resolve the tree.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js http-server.js ./
COPY lib ./lib
COPY tools ./tools

# Runs unprivileged; nothing here needs root.
USER node

ENV PORT=3100
EXPOSE 3100

# The HTTP entry point. It refuses to start without RECIPE_MANAGER_MCP_TOKEN,
# so a misconfigured deploy fails loudly rather than exposing an open endpoint.
CMD ["node", "http-server.js"]
