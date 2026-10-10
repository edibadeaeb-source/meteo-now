"""Server-only credentials for migrating Firebase away from public access."""
import json
import os
import threading

_credentials = None
_lock = threading.Lock()
_SCOPES = ['https://www.googleapis.com/auth/firebase.database',
           'https://www.googleapis.com/auth/userinfo.email']


def authorization_headers():
    global _credentials
    configured = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON') or os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not configured:
        if os.environ.get('METEO_FIREBASE_REQUIRE_AUTH') == '1':
            raise RuntimeError('Firebase server credentials missing')
        return {}  # Migration compatibility only; public DB rules must still be closed.
    with _lock:
        if _credentials is None:
            from google.oauth2 import service_account
            raw = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
            if raw:
                info = json.loads(raw)
                _credentials = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
            else:
                _credentials = service_account.Credentials.from_service_account_file(
                    os.environ['GOOGLE_APPLICATION_CREDENTIALS'], scopes=_SCOPES)
        if not _credentials.valid:
            from google.auth.transport.requests import Request
            transport = Request()
            def bounded_request(*args, **kwargs):
                kwargs['timeout'] = 10
                return transport(*args, **kwargs)
            _credentials.refresh(bounded_request)
        return {'Authorization': 'Bearer ' + _credentials.token}
