"""Integration check on an ephemeral loopback port; no database requests."""
import json
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
import server


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_reader = server.Handler.reader
        server.Handler.reader = server.Reader(fetch=lambda _: [], clock=lambda: 1000)
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        server.Handler.reader = cls.original_reader

    def test_serves_only_dashboard_assets_and_normalized_read_only_data(self):
        for path in ('/', '/stand.css', '/stand.js', '/health', '/api/station'):
            with urlopen(self.url+path) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
        data = json.load(urlopen(self.url+'/api/station'))
        self.assertEqual(data['channels']['esp']['state'], 'empty')

    def test_private_files_not_served(self):
        for path in ('/server.py', '/README.md', '/.runtime/server.pid', '/../app.py', '/keys.py'):
            with self.assertRaises(HTTPError) as error:
                urlopen(self.url+path)
            self.assertEqual(error.exception.code, 404)

    def test_no_writes_and_rejects_cross_site_and_rebinding(self):
        for request, code in [(Request(self.url+'/api/station', method='POST', data=b'{}'),501),
                              (Request(self.url+'/api/station',headers={'Sec-Fetch-Site':'cross-site'}),403),
                              (Request(self.url+'/api/station',headers={'Host':'untrusted.example'}),403)]:
            with self.assertRaises(HTTPError) as error:
                urlopen(request)
            self.assertEqual(error.exception.code, code)


if __name__ == '__main__':
    unittest.main()
