import time
import json
import uuid
import os
import random
import boto3
import psycopg2
from datetime import datetime, timezone
from dotenv import load_dotenv

# ------------------------
# LOAD ENV
# ------------------------
load_dotenv()

# ------------------------
# DEBUG: WHO AM I?
# ------------------------
sts = boto3.client("sts")
print(sts.get_caller_identity())

# ------------------------
# AWS CONFIG
# ------------------------
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")

if not S3_BUCKET:
    raise RuntimeError("S3_BUCKET_NAME environment variable is not set")

print("Bucket:", S3_BUCKET)
print("AWS Region:", AWS_REGION)

# IMPORTANT: let boto3 auto-detect region (avoids AccessDenied)
s3_client = boto3.client(
    "s3",
    region_name="ap-south-1",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)

# ------------------------
# RDS CONFIG
# ------------------------
def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT", 5432)
    )

# ------------------------
# LOG GENERATOR
# ------------------------
USERS = ["admin", "client_user"]
LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

def generate_log():
    owner = random.choice(USERS)
    level = random.choice(LEVELS)
    log_id = str(uuid.uuid4())
    filename = f"{owner}_{log_id}.json"

    log_data = {
        "log_id": log_id,
        "owner": owner,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": "payment-gateway" if owner == "client_user" else "system-monitor",
        "message": (
            "Transaction threshold exceeded"
            if owner == "client_user"
            else "CPU usage spike detected"
        ),
        "simulation_data": random.randint(100, 999)
    }

    # ------------------------
    # S3 KEY (LEVEL BASED)
    # ------------------------
    s3_key = f"{level.lower()}/{owner}/{filename}"

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=json.dumps(log_data, indent=4),
        ContentType="application/json"
    )

    # ------------------------
    # SAVE METADATA TO RDS
    # ------------------------
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO logs (id, filename, level, owner, s3_key)
        VALUES (%s, %s, %s, %s, %s)
    """, (
        log_id,
        filename,
        level,
        owner,
        s3_key
    ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"[S3 + RDS] {level} log stored → {s3_key}")

# ------------------------
# RUN LOOP
# ------------------------
print("Starting Cloud Log Simulation (S3 + RDS)... Ctrl+C to stop")

while True:
    generate_log()
    time.sleep(4)
