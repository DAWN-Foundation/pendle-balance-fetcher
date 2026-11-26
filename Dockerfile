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
CMD ["yarn", "start"]
