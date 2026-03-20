FROM python:3.12-slim

LABEL maintainer="sayonarase"
LABEL description="CaddyConfer - Web UI for Caddy Server Configuration"

# Install git (needed for git push feature)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git openssh-client && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY server.py .
COPY RELEASE_NOTES.md .
COPY public/ public/

# Create data directories
RUN mkdir -p configs certs

# Disable debug mode for production
ENV FLASK_ENV=production

EXPOSE 5555

# Run with production settings
CMD ["python", "server.py"]
