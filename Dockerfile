FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/
RUN pip install --no-cache-dir --index-url https://mirror-pypi.runflare.com/simple --trusted-host mirror-pypi.runflare.com -r requirements.txt

COPY backend/ /app/backend/
COPY css/ /app/css/
COPY js/ /app/js/
COPY assets/ /app/assets/
COPY *.html /app/

WORKDIR /app/backend

RUN mkdir -p /app/backend/staticfiles /app/backend/media

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["gunicorn", "config.wsgi:application", "--bind", "127.0.0.1:8001", "--workers", "3", "--timeout", "120"]
