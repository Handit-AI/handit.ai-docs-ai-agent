# Use the official Node.js 18 runtime as the base image
FROM node:18-alpine

# Build arguments for debugging
ARG BUILD_DATE
ARG COMMIT_SHA
ARG BUILD_ID

# Set environment variables for runtime access
ENV BUILD_DATE=${BUILD_DATE}
ENV COMMIT_SHA=${COMMIT_SHA}
ENV BUILD_ID=${BUILD_ID}

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nextjs:nodejs /usr/src/app
USER nextjs

# Expose the port that the app runs on
EXPOSE 8080

# Define the command to run the application
CMD ["npm", "start"] 