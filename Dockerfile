FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN npm install -g bulkrender-mcp@1.1.0
CMD ["bulkrender-mcp"]
