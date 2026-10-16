import io
import runpy
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock, patch
import requests
import test_ai_context as fixtures

meteo=fixtures.meteo


class LaunchPrivacyTests(unittest.TestCase):
    def test_access_log_format_excludes_parameters_headers_and_identifiers(self):
        settings=runpy.run_path(str(fixtures.ROOT/'gunicorn.conf.py'))
        atoms=dict(t='[17/Oct/2026:01:00:00 +0300]',m='GET',U='/api/push/check',
                   H='HTTP/1.1',s='200',b='123',L='0.004',
                   r='GET /api/push/check?secret=private-token&latitude=44 HTTP/1.1',
                   q='secret=private-token',h='198.18.0.1',a='private-agent',f='private-referrer')
        output=settings['access_log_format'] % atoms
        self.assertIn('GET /api/push/check HTTP/1.1',output)
        for private in ['private-token','secret=','latitude=','198.18.0.1','private-agent','private-referrer']:
            self.assertNotIn(private,output)
        self.assertEqual(meteo.app.test_client().get('/gunicorn.conf.py').status_code,404)

    def test_provider_error_body_is_not_printed_or_returned(self):
        response=Mock(status_code=400,text='PRIVATE-INPUT-AND-COORDINATES')
        response.raise_for_status.side_effect=requests.HTTPError(response=response)
        captured=io.StringIO()
        with patch.object(meteo.requests,'post',return_value=response),redirect_stdout(captured):
            result=meteo.app.test_client().post('/ask',json={'question':'Vremea de azi?'})
        self.assertEqual(result.status_code,500)
        self.assertIn('Claude HTTP 400',captured.getvalue())
        self.assertNotIn('PRIVATE-INPUT',captured.getvalue())
        self.assertNotIn('PRIVATE-INPUT',result.get_data(as_text=True))

    def test_public_policy_covers_provider_retention_and_local_deletion_limits(self):
        text=(fixtures.ROOT/'privacy.html').read_text(encoding='utf8')
        self.assertIn('17 octombrie 2026',text)
        self.assertIn('17 October 2026',text)
        self.assertIn('30 de zile',text)
        self.assertIn('30 days',text)
        self.assertIn('nu șterge automat',text)
        self.assertIn('does not automatically delete',text)


if __name__=='__main__':unittest.main()
