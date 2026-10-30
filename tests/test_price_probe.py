"""The source refresh must never destroy valid evidence on an unsuccessful run."""
import contextlib
import datetime as dt
import io
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.parse

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/verify-price-history.py'
ORIGINAL = b'{"previous":"verified evidence"}\n'


def candle(day, close=10.5):
    stamp = int(dt.datetime.fromisoformat(day).replace(tzinfo=dt.timezone.utc).timestamp())
    return [stamp, 10, 12, 10, close, 100]


class PriceProbeTests(unittest.TestCase):
    def run_probe(self, mode):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = root / 'scripts/verify-price-history.py'
            script.parent.mkdir()
            shutil.copyfile(SCRIPT, script)
            output = root / 'fixtures/sources/restart-price-history.json'
            output.parent.mkdir(parents=True)
            output.write_bytes(ORIGINAL)
            calls = []
            replacements = []
            unchanged_during_requests = []
            read_text = Path.read_text
            replace = Path.replace

            def safe_read(path, *args, **kwargs):
                if str(path) == '/tmp/wallet-price-headers':
                    return 'HTTP/2 200\naccess-control-allow-origin: *\n'
                return read_text(path, *args, **kwargs)

            def record_replace(path, target):
                replacements.append((path, Path(target)))
                return replace(path, target)

            def fake_curl(command, **kwargs):
                calls.append(command)
                unchanged_during_requests.append(output.read_bytes() == ORIGINAL)
                query = urllib.parse.parse_qs(urllib.parse.urlsplit(command[-1]).query)
                start = query['start'][0][:10]
                first = start == '2015-07-30'
                rows = [candle('2016-05-18'), candle('2016-05-18'), candle('2016-05-24', 11)] if first else ([candle('2016-05-24', 11)] if start == '2016-05-24' else [])
                code, status, body = 0, 200, json.dumps(rows)
                if mode == 'transport':
                    code, status, body = 35, 0, ''
                elif mode == 'http':
                    status = 503
                elif mode == 'nonjson' and not first:
                    body = '<html>temporary failure</html>'
                elif mode == 'malformed' and not first:
                    body = json.dumps([[1463529600]])
                elif mode == 'empty':
                    body = '[]'
                elif mode == 'conflict' and first:
                    body = json.dumps([candle('2016-05-18', 10.5), candle('2016-05-18', 11)])
                for flag in ('-D', '--dump-header'):
                    if flag in command:
                        path = Path(command[command.index(flag)+1])
                        if str(path) != '/tmp/wallet-price-headers':
                            path.write_text(f'HTTP/2 {status}\naccess-control-allow-origin: *\n')
                for flag in ('-o', '--output'):
                    if flag in command:
                        Path(command[command.index(flag)+1]).write_text(body)
                stdout = str(status) if any(flag in command for flag in ('-w', '--write-out')) else body
                return subprocess.CompletedProcess(command, code, stdout=stdout, stderr='test transport failure' if code else '')

            stream = io.StringIO()
            escaped = None
            code = 0
            with patch.object(sys, 'argv', [str(script), '--plain']), patch('subprocess.run', side_effect=fake_curl), patch('time.sleep'), patch.object(Path, 'read_text', safe_read), patch.object(Path, 'replace', record_replace), contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
                try:
                    runpy.run_path(str(script), run_name='__main__')
                except SystemExit as error:
                    code = error.code or 0
                except Exception as error:
                    escaped = error
                    code = 1
            return {'code': code, 'escaped': escaped, 'bytes': output.read_bytes(), 'text': stream.getvalue(), 'calls': calls, 'replacements': replacements, 'unchanged': unchanged_during_requests}

    def assert_preserved_failure(self, mode):
        result = self.run_probe(mode)
        self.assertNotEqual(result['code'], 0, 'failed refresh must return nonzero')
        self.assertEqual(result['bytes'], ORIGINAL, 'previous evidence must remain byte-identical')
        self.assertIsNone(result['escaped'], 'CLI must report a concise controlled failure')
        self.assertNotIn('[pass]', result['text'])
        windows = ((dt.datetime.now(dt.timezone.utc).date()-dt.date(2015, 7, 30)).days+298)//299
        self.assertLessEqual(len(result['calls']), windows+2, 'failed window retries must be finite')
        self.assertEqual(result['replacements'], [])

    def test_transport_error_preserves_old_fixture(self):
        self.assert_preserved_failure('transport')

    def test_http_failure_preserves_old_fixture(self):
        self.assert_preserved_failure('http')

    def test_later_nonjson_window_preserves_old_fixture(self):
        self.assert_preserved_failure('nonjson')

    def test_later_malformed_candle_preserves_old_fixture(self):
        self.assert_preserved_failure('malformed')

    def test_all_empty_windows_cannot_claim_price_verification(self):
        self.assert_preserved_failure('empty')

    def test_conflicting_daily_candles_are_not_arbitrarily_selected(self):
        self.assert_preserved_failure('conflict')

    def test_success_commits_once_after_all_windows_and_preserves_gaps(self):
        result = self.run_probe('success')
        self.assertEqual(result['code'], 0)
        self.assertIsNone(result['escaped'])
        self.assertTrue(all(result['unchanged']), 'no partial evidence may replace the previous fixture')
        self.assertEqual(len(result['replacements']), 1)
        evidence = json.loads(result['bytes'])
        self.assertEqual(evidence['prices'], {'2016-05-18': '10.5', '2016-05-24': '11'})
        self.assertNotIn('2016-05-21', evidence['prices'])
        self.assertNotIn('2015-07-30', evidence['prices'])
        self.assertEqual(len(evidence['windows']), len(result['calls']))
        for request in result['calls']:
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(request[-1]).query)
            self.assertEqual(query['granularity'], ['86400'])
            start, end = (dt.date.fromisoformat(query[key][0][:10]) for key in ('start', 'end'))
            self.assertLessEqual((end-start).days, 299)


if __name__ == '__main__':
    unittest.main()
