import os
import requests
from dotenv import load_dotenv

# 1. Load your API URL
load_dotenv()
API_URL = os.getenv("API_URL")
print(f"🔗 Testing URL: {API_URL}")

if not API_URL:
    print("❌ API_URL is missing in .env")
    exit()

# 2. Test Consensus (Text -> Colab) - We know this works
print("\n[1] Testing Consensus Endpoint (Text)...")
try:
    resp = requests.post(f"{API_URL}/agent/consensus", 
                         json={"imaging_text": "A", "audio_text": "B", "history_text": "C"},
                         timeout=10)
    print(f"✅ Consensus Status: {resp.status_code}")
except Exception as e:
    print(f"❌ Consensus Failed: {e}")

# 3. Test Vision (File -> Colab) - This is the suspect
print("\n[2] Testing Vision Endpoint (Image Upload)...")
# Create a dummy blank image
with open("test.txt", "wb") as f:
    f.write(b"fake image data")

try:
    with open("test.txt", "rb") as f:
        # Note: Sending 'test.txt' but calling it 'image' to match the API expectation
        resp = requests.post(f"{API_URL}/agent/vision", 
                             files={"image": f},
                             data={"prompt": "Test"},
                             timeout=30)
    
    if resp.status_code == 200:
        print(f"✅ Vision Status: 200 OK")
        print(f"   Response: {resp.json()}")
    else:
        print(f"❌ Vision Failed: {resp.status_code}")
        print(f"   Error Detail: {resp.text}")
except Exception as e:
    print(f"❌ Connection Error: {e}")

# Cleanup
if os.path.exists("test.txt"): os.remove("test.txt")