FROM python:3.12.9-slim
WORKDIR /app

# First copy ONLY requirements.txt to cache dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Then copy everything else (except .env via .dockerignore)
COPY . .

RUN pip install gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "app:app"]