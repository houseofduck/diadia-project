#!/bin/bash

# Universal Deep Research Backend (UDR-B) - Server Launch Script
# This script launches the FastAPI server with proper configuration

# Load environment variables if .env file exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set default values if not provided
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}
LOG_LEVEL=${LOG_LEVEL:-info}

echo "Starting Universal Deep Research Backend (UDR-B)..."
echo "Host: $HOST"
echo "Port: $PORT"
echo "Log Level: $LOG_LEVEL"

# Launch the server
uvicorn main:app \
    --reload \
    --env-file .env \
    --access-log \
    --log-level=$LOG_LEVEL \
    --host $HOST \
    --port $PORT \
    > uvicorn_main.txt 2>&1 & 

# Wait a moment for the process to start
sleep 2

# Find the uvicorn process ID using ps and grep
PID=$(ps aux | grep "uvicorn main:app" | grep -v grep | awk '{print $2}' | head -1)

if [ -n "$PID" ]; then
    echo "Server started with PID: $PID"
    echo "To stop the server, run: kill $PID"
else
    echo "Warning: Could not find uvicorn process ID"
fi

# Disown the process so it continues running after the script exits
disown $!

echo "Server started in background. Check uvicorn_main.txt for logs."
echo "API available at: http://$HOST:$PORT"