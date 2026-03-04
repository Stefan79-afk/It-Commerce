FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Update
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/li/apt/lists/*

# Copy requiremenet.txt then install packages from there
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# copy code for image (bind mount will override in dev)
COPY ./users_service /app/

EXPOSE 8000

CMD [ "python", "manage.py", "runserver", "0.0.0.0:8000" ]
