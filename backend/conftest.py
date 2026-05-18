"""Top-level conftest: garante que `backend/` esteja no sys.path
para que `import app` funcione tanto rodando `pytest` da raiz do repo
quanto de dentro de `backend/`."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Default seguro para ambiente de testes: nunca herda config de produção.
# `SKIP_DOTENV=1` impede que `app.core.config._load_dotenv()` injete o .env
# do repositório (que contém credenciais reais) em os.environ durante os
# testes. Sem essa flag, qualquer importação de `app.core.config` puxava
# `NOTIFICATION_EMAIL`, `RESEND_API_KEY`, `PAGARME_SECRET_KEY` etc. do disco.
os.environ["SKIP_DOTENV"] = "1"
os.environ["DEBUG"] = "true"
os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000"
os.environ["PAGARME_DRY_RUN"] = "true"
os.environ["FLASK_SECRET_KEY"] = "test-secret-key-with-32-bytes-min__padding"
os.environ["JWT_SECRET"] = "test-jwt-secret-with-32-bytes-min__padding"
