import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('price evidence refresh rejects failed windows and replaces only a fully verified capture',()=>{
  const result=spawnSync('python3',['-m','unittest','discover','-s','tests','-p','test_price_probe.py','-v'],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.error?.message || result.stdout+result.stderr);
});
