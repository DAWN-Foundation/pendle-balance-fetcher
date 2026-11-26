FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY tsconfig.json ./
COPY abis ./abis
COPY src ./src
ENV PORT=8080
EXPOSE 8080
# Run as the image's unprivileged `node` user (uid 1000).
USER node
# Start ts-node directly instead of `yarn start`: corepack would otherwise try to
# fetch yarn into $HOME at startup, which fails on a read-only root filesystem.
CMD ["node_modules/.bin/ts-node", "--transpile-only", "src/main.ts"]
