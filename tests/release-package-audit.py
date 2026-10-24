"""Read-only release integrity audit. No production jobs or push endpoints."""
import hashlib
import json
import pathlib
import re
import struct
import zipfile
from datetime import datetime, timezone
from urllib.request import urlopen

REPO = pathlib.Path(__file__).resolve().parents[1]
PROJECT = REPO.parents[1]
PACKAGE = PROJECT / '02-Lansare-Google-Play/play-store/release-ready'
CURRENT = PACKAGE / 'builds/current'
OUT = PROJECT / '03-Testare-si-capturi/tests/artifacts-release-readiness'


def normalized(data):
    return data.replace(b'\r\n', b'\n')


def main():
    results = {'checkedAt': datetime.now(timezone.utc).isoformat(),
               'readOnlyProduction': True, 'playUploaded': False,
               'physicalPhoneTested': False, 'files': [], 'hosts': []}
    for line in (CURRENT / 'SHA256-1.0.24.txt').read_text().splitlines():
        digest, name = line.split(maxsplit=1)
        actual = hashlib.sha256((CURRENT / name).read_bytes()).hexdigest()
        assert actual.lower() == digest.lower(), name
        results['files'].append({'name': name, 'sha256': actual})
    with zipfile.ZipFile(CURRENT / 'METEO-NOW-1.0.24-widget-source.zip') as archive:
        forbidden = [name for name in archive.namelist()
                     if pathlib.PurePosixPath(name).name.lower() in
                     {'keystore.properties', '.env', 'local.properties'}
                     or name.lower().endswith(('.keystore', '.jks', '.p12'))]
        assert not forbidden, 'Signing/environment files found in source archive'
        results['sourceArchiveSigningFilesExcluded'] = True
    gradle = (REPO / 'android-native/app/build.gradle').read_text(encoding='utf8')
    assert re.search(r'versionCode\s+25\b', gradle)
    assert re.search(r'versionName\s+"1.0.24"', gradle)
    providers = list((REPO / 'android-native/app/src/main/res/xml').glob('meteo*info.xml'))
    assert len(providers) == 5
    assert all('android:updatePeriodMillis="0"' in p.read_text() for p in providers)
    results['widgetProviders'] = 5
    results['images'] = []
    for name, size in [('icon-512.png', (512, 512)),
                       ('feature-graphic-1024x500.png', (1024, 500))]:
        data = (PACKAGE / name).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        dimensions = struct.unpack('>II', data[16:24])
        assert dimensions == size, name
        results['images'].append({'name': name, 'size': dimensions})
    results['docs'] = []
    for source in (REPO / 'release-readiness').glob('*.md'):
        for copy in [PACKAGE / source.name, PACKAGE.parent / source.name]:
            assert source.read_bytes() == copy.read_bytes(), str(copy)
        results['docs'].append(source.name)
    assert (PACKAGE / 'privacy.html').read_bytes() == (REPO / 'privacy.html').read_bytes()
    captures = PACKAGE / 'screenshots/2026-10-13'
    manifest = json.loads((captures / 'manifest.json').read_text(encoding='utf8'))
    assert len(manifest['screenshots']) == 5
    results['screenshots'] = []
    for entry in manifest['screenshots']:
        data = (captures / entry['file']).read_bytes()
        assert data == (REPO / 'release-readiness/screenshots/2026-10-13' / entry['file']).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (1080, 1920)
        assert data[24:26] == bytes([8, 2]), 'Expected 24-bit RGB PNG without alpha'
        assert hashlib.sha256(data).hexdigest() == entry['sha256']
        results['screenshots'].append(entry['file'])
    for host in ['https://meteo-now.onrender.com', 'https://meteo-targoviste.onrender.com']:
        record = {'host': host, 'checks': []}
        for endpoint, local in [('/', 'index.html'), ('/sw.js', 'sw.js'),
                                ('/privacy.html', 'privacy.html'),
                                ('/.well-known/assetlinks.json', 'assetlinks.json')]:
            with urlopen(host + endpoint, timeout=45) as response:
                data = response.read()
                assert response.status == 200
            if local == 'assetlinks.json':
                assert json.loads(data) == json.loads((REPO / local).read_bytes())
                record['localCertificateDeclared'] = True
                record['playCertificateVerified'] = False
            else:
                assert normalized(data) == normalized((REPO / local).read_bytes()), host + endpoint
            record['checks'].append({'endpoint': endpoint, 'status': 200, 'matchesSource': True})
        results['hosts'].append(record)
    results['webVersion'] = '2026.10.24.2'
    assert results['webVersion'] in (REPO / 'diagnostics.py').read_text()
    results['remaining'] = ['developer account registration', 'provider sharing/retention review',
                            'Play Console requirements and signing certificate',
                            'physical push delivery and battery/standby check']
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'release-audit.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf8')
    print('PASS: package hashes, five providers, images, document copies and both public services')


if __name__ == '__main__':
    main()
