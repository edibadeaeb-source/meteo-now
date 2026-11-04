"""Build once: a small licensed OSM vector plan and a locally verifiable QR.

Runtime has no dependency on these build tools and never downloads map tiles.
QR build dependencies: qrcode, Pillow, zxing-cpp (verification only).
"""
from pathlib import Path
import json
import math
import sys
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])
import qrcode
from qrcode.image.svg import SvgPathFillImage
import zxingcpp

APP_URL = 'https://meteo-now.onrender.com/'
LAT, LON = 44.9294563, 25.4521470
METERS_LAT = 111320
METERS_LON = METERS_LAT * math.cos(math.radians(LAT))
WIDTH_M, HEIGHT_M = 800, 480


def project(lat, lon):
    return (500 + (lon-LON)*METERS_LON*1000/WIDTH_M,
            300 - (lat-LAT)*METERS_LAT*600/HEIGHT_M)


def point_string(points):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in points)


def build_map():
    geometry_path = ROOT / 'venue-geometry.json'
    if geometry_path.exists():
        data = json.loads(geometry_path.read_text(encoding='utf-8'))
    else:
        west, east = LON-WIDTH_M/2/METERS_LON, LON+WIDTH_M/2/METERS_LON
        south, north = LAT-HEIGHT_M/2/METERS_LAT, LAT+HEIGHT_M/2/METERS_LAT
        url = f'https://api.openstreetmap.org/api/0.6/map?bbox={west},{south},{east},{north}'
        req = Request(url, headers={'User-Agent':'METEO-NOW-Stand/1.0 (+https://meteo-now.onrender.com)'})
        with urlopen(req, timeout=30) as response:
            raw = response.read(5_000_001)
        if len(raw) > 5_000_000:
            raise RuntimeError('Map extract unexpectedly large')
        osm = ET.fromstring(raw)
        nodes = {x.attrib['id']:(float(x.attrib['lat']),float(x.attrib['lon'])) for x in osm.findall('node')}
        features=[]
        for way in osm.findall('way'):
            tags={x.attrib['k']:x.attrib['v'] for x in way.findall('tag')}
            if not any(key in tags for key in ('highway','building','landuse','leisure','amenity','waterway','natural')):
                continue
            refs=[x.attrib['ref'] for x in way.findall('nd')]
            coords=[nodes[ref] for ref in refs if ref in nodes]
            if len(coords)<2: continue
            features.append({'id':int(way.attrib['id']),'tags':{key:tags[key] for key in ('highway','building','landuse','leisure','amenity','waterway','natural','name') if key in tags},'coordinates':coords,'closed':refs[0]==refs[-1]})
        data={'center':[LAT,LON],'widthMeters':WIDTH_M,'heightMeters':HEIGHT_M,'source':url,
              'schoolSource':'https://www.openstreetmap.org/way/295331770',
              'addressSource':'https://www.carabella.ro/',
              'license':'ODbL 1.0','copyright':'© OpenStreetMap contributors','extractedOn':'2026-11-04','features':features}
        geometry_path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    svg=ET.Element('svg',{'xmlns':'http://www.w3.org/2000/svg','viewBox':'0 0 1000 600','width':'1000','height':'600'})
    ET.SubElement(svg,'title').text='Planul zonei Colegiului Național Constantin Carabella, Târgoviște'
    ET.SubElement(svg,'desc').text='Date © OpenStreetMap contributors, ODbL 1.0. Pozițiile plăcilor sunt planificate la stand, nu GPS.'
    ET.SubElement(svg,'rect',{'width':'1000','height':'600','fill':'#eef1e9'})
    features=data['features']
    for feature in features:
        tags=feature['tags'];points=[project(*p) for p in feature['coordinates']]
        if not feature['closed'] or 'building' in tags: continue
        fill = '#e3e9db'
        if tags.get('amenity')=='school': fill='#e4e7d2'
        if tags.get('leisure') in ('park','garden','pitch') or tags.get('landuse') in ('grass','forest','meadow'):fill='#cfe1c3'
        if tags.get('natural')=='water':fill='#c6deed'
        ET.SubElement(svg,'polygon',{'points':point_string(points),'fill':fill,'stroke':'#cfd6c8','stroke-width':'1'})
    roads=[f for f in features if 'highway' in f['tags']]
    for feature in roads:
        highway=feature['tags']['highway'];points=[project(*p) for p in feature['coordinates']]
        size=14 if highway in ('primary','secondary','tertiary') else 9 if highway in ('residential','unclassified') else 4
        for color,width in [('#c6cecf',size+3),('#ffffff',size)]:
            ET.SubElement(svg,'polyline',{'points':point_string(points),'fill':'none','stroke':color,'stroke-width':str(width),'stroke-linecap':'round','stroke-linejoin':'round'})
    for feature in features:
        if 'building' not in feature['tags']:continue
        points=[project(*p) for p in feature['coordinates']]
        ET.SubElement(svg,'polygon',{'points':point_string(points),'fill':'#d6d7d2','stroke':'#afb6b7','stroke-width':'1.2'})
    school=next((f for f in features if f['id']==295331770),None)
    if school:
        ET.SubElement(svg,'polygon',{'points':point_string([project(*p) for p in school['coordinates']]),'fill':'#d2e3ee','fill-opacity':'.28','stroke':'#427b9b','stroke-width':'2','stroke-dasharray':'6 4'})
    used=set()
    for feature in roads:
        name=feature['tags'].get('name')
        if not name or name in used:continue
        points=[project(*p) for p in feature['coordinates']]
        a,b=points[0],points[-1]
        length=math.hypot(b[0]-a[0],b[1]-a[1])
        x,y=(a[0]+b[0])/2,(a[1]+b[1])/2
        if length<150 or not 40<x<960 or not 35<y<565:continue
        angle=math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]))
        if angle>90:angle-=180
        if angle<-90:angle+=180
        ET.SubElement(svg,'text',{'x':str(x),'y':str(y-6),'transform':f'rotate({angle} {x} {y})','font-family':'Arial,sans-serif','font-size':'13','text-anchor':'middle','fill':'#5e6d74','stroke':'#ffffff','stroke-width':'3','paint-order':'stroke'}).text=name
        used.add(name)
    ET.SubElement(svg,'text',{'x':'500','y':'178','text-anchor':'middle','fill':'#365f78','font-family':'Arial,sans-serif','font-size':'16','font-weight':'bold','stroke':'#f8fbfd','stroke-width':'4','paint-order':'stroke'}).text='Colegiul Național Constantin Carabella'
    ET.SubElement(svg,'path',{'d':'M35 540h125M35 535v10m125-10v10','stroke':'#536b77','stroke-width':'2','fill':'none'})
    ET.SubElement(svg,'text',{'x':'97','y':'563','text-anchor':'middle','font-family':'Arial,sans-serif','font-size':'13','fill':'#536b77'}).text='100 m'
    ET.SubElement(svg,'text',{'x':'950','y':'42','font-family':'Arial,sans-serif','font-size':'16','font-weight':'bold','fill':'#536b77'}).text='N ↑'
    (ROOT/'venue-plan.svg').write_bytes(ET.tostring(svg,encoding='utf-8',xml_declaration=True))
    return len(features)


def build_qr():
    qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q,box_size=12,border=4)
    qr.add_data(APP_URL);qr.make(fit=True)
    qr.make_image(image_factory=SvgPathFillImage).save(ROOT/'app-qr.svg')
    raster=qr.make_image(fill_color='#18334e',back_color='white').convert('RGB')
    decoded=zxingcpp.read_barcode(raster)
    if decoded is None or decoded.text!=APP_URL:
        raise RuntimeError('QR verification failed')
    raster.save(ROOT/'app-qr.png')
    return decoded.text


if __name__=='__main__':
    print(json.dumps({'mapFeatures':build_map(),'qrDecoded':build_qr(),'mapTilesDownloaded':0},ensure_ascii=False))
