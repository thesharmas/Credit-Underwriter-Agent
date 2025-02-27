FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default port
ENV PORT=8080

# Use environment variables from .env in local development
CMD exec python main.py


