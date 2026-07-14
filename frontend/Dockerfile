# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Vite's default port
EXPOSE 3000

# Expose host to allow connections from outside the container
CMD ["npm", "run", "dev", "--", "--host"]
