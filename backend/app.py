from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import boto3
import os
from datetime import datetime
import psycopg2
import psycopg2.extras
import uuid
import os

def get_db():
    return psycopg2.connect(
        host=os.getenv("PGHOST"),
        database=os.getenv("PGDATABASE"),
        user=os.getenv("PGUSER"),
        password=os.getenv("PGPASSWORD"),
        port=os.getenv("PGPORT", 5432)
    )


app = Flask(__name__)
CORS(app)

DB_FILE = "database.db"

# ------------------------
# AWS S3 CONFIG
# ------------------------
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)

# ------------------------
# DB INIT
# ------------------------
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT,
            role TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            filename TEXT,
            level TEXT,
            timestamp DATETIME,
            owner TEXT,
            s3_key TEXT
        )
    """)

    cursor.execute("INSERT OR IGNORE INTO users VALUES ('admin', 'admin123', 'Administrator')")
    cursor.execute("INSERT OR IGNORE INTO users VALUES ('client_user', 'client123', 'Standard Client')")

    conn.commit()
    conn.close()

init_db()

# ------------------------
# AUTH
# ------------------------
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (data['username'], data['password'])
    )
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({"success": True, "user": user[0], "role": user[2]})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

# ------------------------
# UPLOAD LOG FILE TO S3
# ------------------------
VALID_LOG_LEVELS = {"debug", "info", "warning", "error", "critical"}

@app.route('/api/upload-log', methods=['POST'])
def upload_log():
    file = request.files.get('file')
    level = request.form.get('level', '').upper()
    owner = request.form.get('owner')

    VALID_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}

    if not file or not level or not owner:
        return jsonify({"error": "Missing required fields"}), 400

    if level not in VALID_LEVELS:
        return jsonify({"error": "Invalid log level"}), 400

    log_id = str(uuid.uuid4())

    s3_key = f"{level.lower()}/{owner}/{log_id}_{file.filename}"

    # Upload to S3
    s3_client.upload_fileobj(
        file,
        S3_BUCKET,
        s3_key,
        ExtraArgs={"ContentType": file.content_type}
    )

    # Save metadata in RDS
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO logs (id, filename, level, owner, s3_key)
        VALUES (%s, %s, %s, %s, %s)
    """, (
        log_id,
        file.filename,
        level,
        owner,
        s3_key
    ))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "success": True,
        "log_id": log_id
    })


# ------------------------
# ANALYTICS
# ------------------------
@app.route('/api/stats', methods=['GET'])
def get_stats():
    user = request.args.get('user')
    conn = sqlite3.connect(DB_FILE)

    if user == 'admin':
        query = "SELECT level, COUNT(*) FROM logs GROUP BY level"
        args = ()
    else:
        query = "SELECT level, COUNT(*) FROM logs WHERE owner=? GROUP BY level"
        args = (user,)

    cursor = conn.execute(query, args)
    data = [{"name": row[0], "value": row[1]} for row in cursor.fetchall()]
    conn.close()
    return jsonify(data)

# ------------------------
# LOG FETCH WITH FILTERING
# ------------------------
@app.route('/api/logs', methods=['GET'])
def get_logs():
    user = request.args.get('user')
    level = request.args.get('level')
    search = request.args.get('search')

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    sql = "SELECT id, filename, level, owner, created_at AS timestamp FROM logs WHERE 1=1"
    params = []

    if user != 'admin':
        sql += " AND owner=%s"
        params.append(user)

    if level and level != "ALL":
        sql += " AND level=%s"
        params.append(level.upper())

    if search:
        sql += " AND filename ILIKE %s"
        params.append(f"%{search}%")

    sql += " ORDER BY created_at DESC LIMIT 50"

    cur.execute(sql, params)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify(rows)


# ------------------------
# VIEW FILE FROM S3 (SECURE)
# ------------------------
@app.route('/api/view-log/<log_id>')
def view_log(log_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT s3_key FROM logs WHERE id=%s", (log_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({"error": "Not found"}), 404

    url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": row[0]},
        ExpiresIn=300
    )

    return jsonify({"url": url})

@app.route('/api/download-log/<log_id>')
def download_log(log_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT s3_key, filename FROM logs WHERE id=%s", (log_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({"error": "Not found"}), 404

    s3_key, filename = row

    s3_client = boto3.client(
        "s3",
        region_name="ap-south-1"   # 🔴 THIS LINE SOLVES EVERYTHING
    )

    print("Presign region:", s3_client.meta.region_name)

    url = s3_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": "dbms-lab",
            "Key": s3_key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"'
        },
        ExpiresIn=300
    )

    return jsonify({"url": url})




# ------------------------
if __name__ == '__main__':
    app.run(port=5000, debug=True)
