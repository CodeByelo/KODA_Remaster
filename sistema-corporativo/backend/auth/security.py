import os
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# CONFIGURACIÓN DE SEGURIDAD
SECRET_KEY = os.getenv("JWT_SECRET", "tu_clave_secreta_muy_segura_cambiala_en_produccion")
ALGORITHM = "HS256"

# Acepta hashes legacy bcrypt y genera hashes nuevos con pbkdf2_sha256.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        if not hashed_password or not isinstance(hashed_password, str):
            return False
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            try:
                return bcrypt.checkpw(
                    plain_password.encode("utf-8"),
                    hashed_password.encode("utf-8"),
                )
            except Exception:
                return False
        return False

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=1440))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
