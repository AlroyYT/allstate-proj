import time
import json
import uuid
import os
import sqlite3
import random
from datetime import datetime

# CONFIGURATION
BUCKET_DIR = "mock_s3_bucket"
DB_FILE = "database.db"

# Ensure mock bucket exists
if not os.path.exists(BUCKET_DIR):
    os.makedirs(BUCKET_DIR)

# Initialize DB for LOGS (with 'owner' column for unique views)
conn = sqlite3.connect(DB_FILE)
conn.execute('''CREATE TABLE IF NOT EXISTS logs 
                (id TEXT PRIMARY KEY, filename TEXT, level TEXT, timestamp DATETIME, owner TEXT)''')
conn.close()

def generate_log():
    # Simulate two different users to prove unique views
    users = ["admin", "client_user"]
    levels = ["INFO", "WARNING", "ERROR", "CRITICAL"]
    
    selected_user = random.choice(users)
    log_id = str(uuid.uuid4())
    filename = f"{selected_user}_{log_id}.json"
    
    # 1. Create the Log Data
    log_data = {
        "log_id": log_id,
        "owner": selected_user,
        "timestamp": datetime.now().isoformat(),
        "level": random.choice(levels),
        "service": "payment-gateway" if selected_user == "client_user" else "system-monitor",
        "message": "Transaction threshold exceeded" if selected_user == "client_user" else "CPU usage spike detected",
        "simulation_data": random.randint(100, 999)
    }

    # 2. "Upload" to S3 (Save to folder)
    file_path = os.path.join(BUCKET_DIR, filename)
    with open(file_path, 'w') as f:
        json.dump(log_data, f, indent=4)

    # 3. Save Metadata to DBMS (SQLite)
    conn = sqlite3.connect(DB_FILE)
    conn.execute("INSERT INTO logs (id, filename, level, timestamp, owner) VALUES (?, ?, ?, ?, ?)",
                 (log_id, filename, log_data['level'], log_data['timestamp'], selected_user))
    conn.commit()
    conn.close()

    print(f"[SIMULATION] Generated {filename} -> Owner: {selected_user}")

# Run loop
print("Starting Log Simulation... (Press Ctrl+C to stop)")
while True:
    generate_log()
    time.sleep(4) # New log every 4 seconds