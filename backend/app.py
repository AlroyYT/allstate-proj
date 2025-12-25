from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
CORS(app)

DB_FILE = "database.db"
BUCKET_DIR = "mock_s3_bucket"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    conn.execute('''CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, role TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, filename TEXT, level TEXT, timestamp DATETIME, owner TEXT)''')
    
    # Create Users
    cursor.execute("INSERT OR IGNORE INTO users VALUES ('admin', 'admin123', 'Administrator')")
    cursor.execute("INSERT OR IGNORE INTO users VALUES ('client_user', 'client123', 'Standard Client')")
    conn.commit()
    conn.close()

init_db()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({"success": True, "user": username, "role": user[2]})
    return jsonify({"success": False, "message": "Invalid Credentials"}), 401

# --- PROFESSIONAL FEATURE 1: ANALYTICS (SQL AGGREGATION) ---
@app.route('/api/stats', methods=['GET'])
def get_stats():
    user = request.args.get('user')
    conn = sqlite3.connect(DB_FILE)
    
    # Admin sees GLOBAL stats, Client sees PERSONAL stats
    if user == 'admin':
        # "Count how many logs exist for EACH level"
        query = "SELECT level, COUNT(*) as count FROM logs GROUP BY level"
        args = ()
    else:
        query = "SELECT level, COUNT(*) as count FROM logs WHERE owner=? GROUP BY level"
        args = (user,)
        
    cursor = conn.execute(query, args)
    # Transform into format for Recharts: [{name: 'ERROR', value: 10}, ...]
    data = [{"name": row[0], "value": row[1]} for row in cursor.fetchall()]
    conn.close()
    return jsonify(data)

# --- PROFESSIONAL FEATURE 2: COMPLEX FILTERING ---
@app.route('/api/logs', methods=['GET'])
def get_logs():
    user = request.args.get('user')
    level_filter = request.args.get('level', 'ALL') # Default to ALL
    search_query = request.args.get('search', '')   # Default to empty
    
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    
    # Base Query
    sql = "SELECT * FROM logs WHERE 1=1"
    params = []

    # 1. User Security Layer
    if user != 'admin':
        sql += " AND owner = ?"
        params.append(user)

    # 2. Level Filter (If selected)
    if level_filter != 'ALL':
        sql += " AND level = ?"
        params.append(level_filter)

    # 3. Search Filter (Text Search)
    if search_query:
        sql += " AND filename LIKE ?"
        params.append(f"%{search_query}%")

    sql += " ORDER BY timestamp DESC LIMIT 50"
    
    cursor = conn.execute(sql, tuple(params))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(logs)

@app.route('/s3-view/<filename>')
def view_s3_file(filename):
    return send_from_directory(BUCKET_DIR, filename)

if __name__ == '__main__':
    app.run(port=5000, debug=True)