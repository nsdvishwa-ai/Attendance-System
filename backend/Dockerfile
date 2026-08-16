FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and GUI support
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install pre-built dlib wheel to skip compilation completely
RUN pip install --no-cache-dir https://github.com/z-a-n-i/dlib-wheels/raw/main/dlib-19.24.1-cp310-cp310-linux_x86_64.whl

COPY requirements.txt .
# Remove 'dlib' from requirements.txt if present so it doesn't try to reinstall it
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]