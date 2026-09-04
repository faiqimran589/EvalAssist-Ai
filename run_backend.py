import sys
import os
from pathlib import Path

# Add backend directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Change working directory to backend so sqlite and uploads stay localized
os.chdir(str(BACKEND_DIR))

if __name__ == "__main__":
    import uvicorn
    print("Starting EvalAssist AI Backend on http://0.0.0.0:8001 ...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
