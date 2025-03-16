import sqlite3
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def init_db():
    db_path = os.getenv('DB_PATH', 'papers.db')
    
    # Read schema
    with open('schema.sql', 'r') as f:
        schema = f.read()
    
    # Initialize database
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema)
        print(f"Database initialized at {db_path}")

if __name__ == '__main__':
    init_db()
