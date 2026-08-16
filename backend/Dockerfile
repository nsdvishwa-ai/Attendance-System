FROM python:3.10-slim

WORKDIR /app

# Install runtime dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install pre-compiled binary dlib
RUN pip install --no-cache-dir dlib-bin

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install face_recognition without pulling standard dlib dependency
RUN pip install --no-cache-dir face_recognition --no-deps

COPY . .

ENV PYTHONPATH=/app

# Updated import path to app.main:app
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}