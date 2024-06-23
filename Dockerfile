FROM node:20-alpine AS base
EXPOSE 3000 3001 3002
ARG APP
WORKDIR /app
COPY package*.json .

FROM base AS development
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
RUN npm install
COPY . .
RUN npm run build ${APP}

ENV DEPLOY_COMMAND="node /app/dist/apps/${APP}/main"
CMD $DEPLOY_COMMAND

FROM base AS production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
RUN npm install --production
COPY . .
RUN npm run build ${APP}

ENV DEPLOY_COMMAND="node /app/dist/apps/${APP}/main"
CMD $DEPLOY_COMMAND