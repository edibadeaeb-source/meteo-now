"""Bounded localhost-only HTTP load exercise. Never accepts a remote target.

Two independent Python processes run the real Flask app and share only its disk
cache and quota store. Provider responses are simulated; no secrets or cloud
database are used. Werkzeug threads are a test harness, not Render's Gunicorn.
"""
import json,logging,multiprocessing as mp,os,pathlib,statistics,sys,tempfile,time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request,urlopen
from urllib.error import HTTPError
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
CITIES=[(44.983,25.644),(44.4268,26.1025),(40.7128,-74.006)]

def worker(directory,ports,counters):
    os.environ.update(PORT='5000',RENDER='true',METEO_SECURITY_STATE_DIR=directory)
    os.environ.pop('FIREBASE_SERVICE_ACCOUNT_JSON',None)
    import requests
    # Fail closed if any code in this harness tries to reach the real network.
    def denied(*args,**kwargs):raise AssertionError('External network forbidden in load harness')
    requests.sessions.Session.request=denied
    from test_weather_service import fixtures,Response,NOW
    import app as meteo
    from weather_service import WeatherService
    from werkzeug.serving import make_server,WSGIRequestHandler
    base,met,owm=fixtures()
    def get(url,**kwargs):
        source='met' if 'met.no' in url else 'owm' if 'openweathermap' in url else 'base'
        with counters.get_lock():counters[{'base':0,'met':1,'owm':2}[source]]+=1
        time.sleep(.1)
        data=met if source=='met' else owm if source=='owm' else dict(base,latitude=kwargs['params']['latitude'],longitude=kwargs['params']['longitude'])
        return Response(data)
    meteo._weather_service=WeatherService('fixture-only',get,lambda:NOW,cache_dir=pathlib.Path(directory)/'weather')
    meteo.app.extensions['security_budgets'].clock=lambda:1791734400
    reserve=meteo.app.extensions['security_budgets'].reserve
    def probe_reserve(rules):
        try:return reserve(rules)
        except Exception as e:
            print('LOCAL QUOTA FAILURE:',type(e).__name__,str(e),flush=True)
            raise
    meteo.app.extensions['security_budgets'].reserve=probe_reserve
    meteo.app.extensions['diagnostics'].submit=lambda event:True
    logging.getLogger('werkzeug').disabled=True
    class Quiet(WSGIRequestHandler):
        def log_request(self,*a,**k):pass
        def log_error(self,*a,**k):pass
    server=make_server('127.0.0.1',0,meteo.app,threaded=True,request_handler=Quiet)
    ports.put(server.server_port);server.serve_forever()

def run():
    with tempfile.TemporaryDirectory(prefix='meteo-load-local-') as directory:
        ctx=mp.get_context('spawn');ports=ctx.Queue();counts=ctx.Array('i',3)
        processes=[ctx.Process(target=worker,args=(directory,ports,counts),daemon=True) for _ in range(2)]
        try:
            for p in processes:p.start()
            targets=['http://127.0.0.1:'+str(ports.get(timeout=40)) for _ in processes]
            def hit(i,ip=None):
                lat,lon=CITIES[i%len(CITIES)];start=time.perf_counter()
                request=Request(targets[i%2]+f'/api/weather/forecast?latitude={lat}&longitude={lon}',headers={'CF-Connecting-IP':ip or f'198.18.{i//200}.{i%200+1}'})
                try:
                    with urlopen(request,timeout=20) as r:
                        status=r.status;body=json.load(r);retry=r.headers.get('Retry-After')
                except HTTPError as e:status=e.code;body=json.load(e);retry=e.headers.get('Retry-After')
                return status,(time.perf_counter()-start)*1000,body,retry
            rounds=[]
            for number,concurrency in [(200,20),(800,64)]:
                start=time.perf_counter()
                with ThreadPoolExecutor(max_workers=concurrency) as pool:responses=list(pool.map(hit,range(number)))
                duration=time.perf_counter()-start;latencies=sorted(r[1] for r in responses)
                bad=[(r[0],r[2]) for r in responses if r[0]!=200 or r[2]['current']['temperature_2m']!=23.7]
                assert not bad, f'Forecast failure under bounded load: {bad[:3]}'
                assert all(r[2]['latitude']==round(CITIES[i%3][0],4) for i,r in enumerate(responses)), 'City contamination'
                rounds.append({'requests':number,'concurrency':concurrency,'seconds':round(duration,3),'p50_ms':round(statistics.median(latencies),1),'p95_ms':round(latencies[int(.95*(number-1))],1),'errors':0})
            assert list(counts)==[3,3,3],f'Cache should assemble each of three cities only once: {list(counts)}'
            # One source IP exceeds its real 240/min limit across both processes.
            with ThreadPoolExecutor(max_workers=20) as pool:limited=list(pool.map(lambda i:hit(i,'198.19.0.1'),range(245)))
            statuses={str(s):sum(r[0]==s for r in limited) for s in (200,429)}
            assert statuses=={'200':200,'429':45},statuses # global 1200/min, already used 1000
            assert all(r[3] for r in limited if r[0]==429),'Missing recovery interval'
            assert list(counts)==[3,3,3],'Rejected requests cannot reach providers'
            result={'target':'localhost only','httpProcesses':2,'harness':'threaded Werkzeug; production has two synchronous Gunicorn workers','providers':'simulated 100ms; no external API/database calls','rounds':rounds,'upstreamCalls':{'Open-Meteo':counts[0],'MET Norway':counts[1],'OpenWeather':counts[2]},'quotaProbe':statuses,'quotaReason':'shared global 1200/min reached after first 1000; Retry-After verified','renderCapacityClaim':False}
            out=ROOT.parents[1]/'03-Testare-si-capturi/tests/artifacts-network';out.mkdir(parents=True,exist_ok=True)
            (out/'load-results.json').write_text(json.dumps(result,indent=2),encoding='utf8')
            print('PASS: '+json.dumps(result))
        finally:
            for p in processes:
                if p.is_alive():p.terminate()
                p.join(timeout=10)

if __name__=='__main__':run()
