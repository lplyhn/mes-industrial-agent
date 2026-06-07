import sys, os
os.chdir(os.path.dirname(__file__) or '.')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from gateway import app, detect, fetch_data, fmt_dr
import json
from fastapi.testclient import TestClient

client = TestClient(app)

# Test 1: detect
print('=== Test detect ===')
print('detect(\"生产日报\"):', detect('生产日报'))
print('detect(\"生成今日生产日报\"):', detect('生成今日生产日报'))

# Test 2: Non-streaming
print()
print('=== Test non-streaming ===')
resp = client.post('/v1/chat/completions', json={'model':'gpt-4o','messages':[{'role':'user','content':'生成今日生产日报'}],'stream':False})
data = resp.json()
content = data['choices'][0]['message']['content']
print('Content:')
print(content[:400])
print('...')
print()
print('Contains \"产量与OEE\":', '产量与OEE' in content)
print('Contains \"质量风险\":', '质量风险' in content)
print('Contains \"设备报警\":', '设备报警' in content)

# Test 3: Streaming - first progress event
print()
print('=== Test streaming first event ===')
with client.stream('POST', '/v1/chat/completions', json={'model':'gpt-4o','messages':[{'role':'user','content':'生成今日生产日报'}],'stream':True}) as stream_resp:
    lines = []
    for chunk in stream_resp.iter_lines():
        lines.append(chunk)
        if len(lines) >= 10:
            break
    for line in lines:
        if 'hermes' in line or 'tool' in line:
            print(line[:200])
