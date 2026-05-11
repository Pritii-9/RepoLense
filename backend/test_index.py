import asyncio
from pathlib import Path
import sys
import os
sys.path.append('.')
from app.services.vector_store import VectorStoreService

async def test():
    try:
        os.makedirs('dummy_repo', exist_ok=True)
        with open('dummy_repo/test.py', 'w') as f:
            f.write('print("hello")')
        vs = VectorStoreService('test_id')
        print('Starting index...')
        res = await vs.index_repository(Path('dummy_repo'))
        print('Indexed docs:', res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
