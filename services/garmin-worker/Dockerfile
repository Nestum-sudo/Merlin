FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium

COPY src/ src/

# Processo persistente, não serverless — o Playwright não se dá bem com
# arranques a frio. Correr em Railway/Fly.io, não em funções serverless.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
