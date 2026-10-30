import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('withdrawn legacy price probe makes no request and directs users to the current USD source',()=>{
  const code=`import contextlib,io,pathlib,runpy,shutil,subprocess,sys,tempfile\nfrom unittest.mock import patch\nwith tempfile.TemporaryDirectory() as temp:\n root=pathlib.Path(temp);(root/'scripts').mkdir();script=root/'scripts/probe-sources.py';shutil.copyfile('scripts/probe-sources.py',script)\n output=io.StringIO()\n with patch.object(sys,'argv',[str(script),'coingecko','--plain']),patch('subprocess.run',return_value=subprocess.CompletedProcess([],35,'000','mock failure')) as request,contextlib.redirect_stdout(output):\n  try:runpy.run_path(str(script),run_name='__main__')\n  except SystemExit as error:assert error.code==2\n assert request.call_count==0,'Withdrawn source must never be retried'\n assert 'verify-price-history.py' in output.getvalue(),output.getvalue()\n`;
  const result=spawnSync('python3',['-c',code],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
});
