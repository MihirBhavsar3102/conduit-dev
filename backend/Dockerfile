# backend/Dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package management files to leverage Docker layer caching
COPY package*.json ./

RUN npm install

# Copy the rest of the backend source code
COPY . .

# Expose Express.js default or designated port
EXPOSE 3001

# Start application
CMD ["npm", "start"]
