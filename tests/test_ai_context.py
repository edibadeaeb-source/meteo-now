import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("meteo_app", ROOT / "app.py")
meteo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(meteo)


def snapshot(lat=40.7128, lon=-74.006):
    return {
        "schema": 2,
        "stare_date": "disponibile",
        "localitate": {"nume": "New York City", "lat": lat, "lon": lon,
                        "fus_orar": "America/New_York"},
        "unitate_temperatura": "°C",
        "curent": {"temperatura": "12°C", "temperatura_c": 12.3,
                    "stare": "Parțial noros", "umiditate_procente": 60},
        "azi": {"minima": "8°C", "maxima": "31°C"},
        "prognoza_ore": [{"moment": "2026-09-16T14:00", "temperatura": "13°C"}],
        "prognoza_zile": [{"data": "2026-09-17", "minima": "9°C", "maxima": "24°C"}],
        "avertizari_anm": "nu se aplica in afara Romaniei",
    }


class WeatherPromptTests(unittest.TestCase):
    def test_current_is_distinct_from_daily_maximum(self):
        text = meteo.build_weather_prompt(snapshot(), {"lat": 40.7128, "lon": -74.006})
        self.assertIn('"temperatura":"12°C"', text)
        self.assertIn('"maxima":"31°C"', text)
        self.assertIn("NU sunt temperatura de acum", text)

    def test_snapshot_from_another_city_is_rejected(self):
        text = meteo.build_weather_prompt(snapshot(), {"lat": 44.9266, "lon": 25.4566})
        self.assertIn("NU APARTINE LOCALITATII", text)
        self.assertNotIn("31°C", text)

    @patch.object(meteo.requests, "post")
    def test_ask_sends_selected_city_snapshot_and_timezone(self, post):
        post.return_value.raise_for_status.return_value = None
        post.return_value.json.return_value = {"content": [{"text": "Acum sunt 12°C."}], "stop_reason": "end_turn"}
        meteo.ANTHROPIC_API_KEY = "test-key"
        body = {"question": "Câte grade sunt acum?", "lang": "ro",
                "locatie": {"nume": "New York City", "tara": "US", "admin": "New York",
                             "lat": 40.7128, "lon": -74.006, "tz": "America/New_York",
                             "inRomania": False, "areStatiiProprii": False},
                "vremea": snapshot(), "context": {}, "history": []}
        response = meteo.app.test_client().post("/ask", json=body)
        self.assertEqual(response.status_code, 200)
        sent = post.call_args.kwargs["json"]["system"]
        self.assertIn('"temperatura":"12°C"', sent)
        self.assertIn("America/New_York", sent)
        self.assertNotIn("ora Romaniei).", sent)


if __name__ == "__main__":
    unittest.main()
