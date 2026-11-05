import unittest
from unittest.mock import patch
import server
import json


class StationTests(unittest.TestCase):
    def test_zero_aliases_and_reject_invalid_numbers(self):
        item = server.normalize({'temperature': 0, 'humidity': 0, 'iaq': float('nan'), 'pressure': True, 'gas': -2})
        self.assertEqual(item['temperature'], 0)
        self.assertEqual(item['humidity'], 0)
        self.assertIsNone(item['iaq'])
        self.assertIsNone(item['pressure'])
        self.assertIsNone(item['gas'])

    def test_timestamps_ms_seconds_iso_and_missing(self):
        self.assertEqual(server.timestamp({'server_timestamp': 1793800000000, 'timestamp': 1}), 1793800000)
        self.assertEqual(server.timestamp({'timestamp': 1793800000}), 1793800000)
        self.assertEqual(server.timestamp({'timestamp': '2026-11-04T00:00:00Z'}), 1793750400)
        self.assertIsNone(server.timestamp({'timestamp': 'yesterday'}))
        self.assertIsNone(server.timestamp({'timestamp': 1e100}))

    def test_history_sorted_and_bounded(self):
        rows = server.records({str(i): {'temperatura': 20, 'timestamp': 1000+i} for i in reversed(range(90))})
        self.assertEqual(len(rows), 60)
        self.assertEqual(rows[0]['timestamp'], 1030)
        self.assertEqual(rows[-1]['timestamp'], 1089)
        self.assertEqual(server.records(None), [])
        self.assertEqual(len(server.records({'temperatura': 20})), 1)

    def test_stale_future_missing_and_empty_not_live(self):
        for record, expected in [({'timestamp': 100}, 'stale'), ({'timestamp': 2000}, 'unknown'), ({}, 'unknown')]:
            reader = server.Reader(fetch=lambda _: server.records({'temperatura': 20, **record}), clock=lambda: 1000)
            self.assertEqual(reader.snapshot()['channels']['esp']['state'], expected)
        reader = server.Reader(fetch=lambda _: [], clock=lambda: 1000)
        self.assertEqual(reader.snapshot()['channels']['esp']['state'], 'empty')

    def test_cache_and_outage_preserves_then_recovers(self):
        calls = []
        now = [1000]
        fail = [False]
        def fetch(kind):
            calls.append(kind)
            if fail[0]: raise TimeoutError()
            return server.records({'temperatura': 21, 'timestamp': now[0]})
        reader = server.Reader(fetch=fetch, clock=lambda: now[0])
        self.assertEqual(reader.snapshot()['channels']['esp']['state'], 'live')
        reader.snapshot()
        self.assertEqual(len(calls), 3)
        now[0] += 21; fail[0] = True
        snapshot = reader.snapshot()
        self.assertEqual(snapshot['channels']['esp']['state'], 'unavailable')
        self.assertEqual(snapshot['channels']['esp']['current']['temperature'], 21)
        now[0] += 21; fail[0] = False
        self.assertEqual(reader.snapshot()['channels']['esp']['state'], 'live')

    def test_lora_history_does_not_hide_failed_current_read(self):
        def fetch(kind):
            if kind == 'lora': raise TimeoutError()
            return server.records({'temperatura': 20, 'timestamp': 1000})
        self.assertEqual(server.Reader(fetch=fetch, clock=lambda:1000).snapshot()['channels']['lora']['state'], 'unavailable')

    def test_fixed_paths_get_only_and_bounded_query(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, limit):
                self.assert_limit = limit
                return b'null'
        with patch.object(server, 'urlopen', return_value=Response()) as opened:
            for kind in server.PATHS:
                server.read_public(kind)
                req = opened.call_args.args[0]
                self.assertEqual(req.method, 'GET')
                self.assertTrue(req.full_url.startswith(server.DATABASE + '/' + server.PATHS[kind] + '.json'))
                if kind != 'lora': self.assertIn('limitToLast=60', req.full_url)
                self.assertNotIn('auth=', req.full_url)
        with self.assertRaises(KeyError): server.read_public('../push_subs')

    def test_chat_context_zeroes_no_location_or_invented_lora_iaq(self):
        body = {'question':'Explică datele', 'history':[], 'sensors':{
            'esp':{'current':{'temperature':0,'humidity':0,'iaq':0}},
            'lora':{'current':{'temperature':0,'humidity':0,'iaq':99,'private':'ignored'}}}}
        result = server.chat_payload(body)
        details = result['vremea']['detalii']
        self.assertIn('Datele marcate ISTORIC', details)
        snapshot = json.loads(details.split('Snapshotul afisat: ')[1])
        self.assertEqual(snapshot['esp']['valori']['temperature'], 0)
        self.assertEqual(snapshot['esp']['valori']['iaq'], 0)
        self.assertNotIn('iaq', snapshot['lora']['valori'])
        self.assertNotIn('private', details)
        self.assertEqual(result['locatie'], {})
        self.assertEqual(result['context'], {})

    def test_chat_does_not_call_old_data_live_and_rejects_invalid_input(self):
        body = {'question':'Explică', 'sensors':{
            key:{'current':{'temperature':20,'timestamp':1000}} for key in ('esp','lora')}}
        self.assertIn('ISTORIC VECHI', server.chat_payload(body)['vremea']['detalii'])
        for invalid in [None, {}, {**body,'question':'x'*1201}, {**body,'history':[{'role':'system','text':'x'}]}]:
            with self.assertRaises(server.ChatError): server.chat_payload(invalid)

    def test_chat_relay_uses_only_primary_endpoint_without_keys(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, _): return b'{"answer":"Example"}'
        with patch.object(server, 'urlopen', return_value=Response()) as opened:
            self.assertEqual(server.relay_chat({'question':'Example'}), {'answer':'Example'})
            req = opened.call_args.args[0]
            self.assertEqual(req.full_url, 'https://meteo-now.onrender.com/ask')
            self.assertEqual(req.method, 'POST')
            self.assertNotIn('Authorization', req.headers)


if __name__ == '__main__':
    unittest.main()
