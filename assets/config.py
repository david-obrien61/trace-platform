import os
import json
import logging
import socket

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSET_DIR = os.path.join(BASE_DIR, "RawElementAssets")
os.makedirs(ASSET_DIR, exist_ok=True)

# Setup master debug logging in the same absolute directory
LOG_FILE = os.path.join(BASE_DIR, 'asset_manager_debug.log')
logging.basicConfig(filename=LOG_FILE, level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Application configuration loaded...")

CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

def get_api_key():
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        return api_key
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f).get("gemini_api_key", "")
    return ""

def set_api_key(key):
    with open(CONFIG_FILE, "w") as f:
        json.dump({"gemini_api_key": key}, f)

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP