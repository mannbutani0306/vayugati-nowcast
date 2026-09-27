FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
COPY backend /app/backend
COPY verification /app/verification
EXPOSE 8000
CMD ["uvicorn", "backend.nowcast_engine:app", "--host", "0.0.0.0", "--port", "8000"]
