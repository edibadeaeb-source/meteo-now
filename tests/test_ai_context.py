import importlib.util
import json
import pathlib
import unittest
from unittest.mock import MagicMock, patch

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



class WidgetApiTests(unittest.TestCase):
    @patch.object(meteo.requests, "get")
    def test_widget_returns_four_future_days(self, get):
        current = MagicMock()
        current.raise_for_status.return_value = None
        current.json.return_value = {
            "main": {"temp": 14.2, "feels_like": 13.1, "humidity": 55},
            "weather": [{"id": 801, "icon": "02d", "description": "puțin noros"}],
            "wind": {"speed": 2.5},
            "sys": {"sunrise": 0, "sunset": 0},
            "timezone": 0,
        }
        daily = MagicMock()
        daily.raise_for_status.return_value = None
        daily.json.return_value = {
            "daily": {
                "time": ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"],
                "temperature_2m_max": [18, 19, 20, 21, 22],
                "temperature_2m_min": [8, 9, 10, 11, 12],
                "weathercode": [1, 2, 3, 61, 0],
            }
        }
        get.side_effect = [current, daily]
        meteo._widget_cache.clear()

        response = meteo.app.test_client().get(
            "/api/widget?lat=40.7128&lon=-74.006&oras=New%20York&admin=New%20York&country=US"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(len(data["zile"]), 4)
        self.assertEqual(data["zile"][0]["max"], 19)
        self.assertEqual(data["zile"][3]["min"], 12)

class ClimateArchiveTests(unittest.TestCase):
    @patch.object(meteo.requests, "get")
    def test_cold_city_uses_one_archive_request(self, get):
        dates = []
        maxime = []
        minime = []
        for year in range(1996, 2026):
            dates.extend([f"{year}-09-20", f"{year}-09-21"])
            maxime.extend([10.0, 20.0 + (year % 5)])
            minime.extend([2.0, 8.0 + (year % 4)])

        get.return_value.raise_for_status.return_value = None
        get.return_value.json.return_value = {
            "daily": {
                "time": dates,
                "temperature_2m_max": maxime,
                "temperature_2m_min": minime,
            }
        }

        result = meteo._clima_interval_30_ani(
            48.8566, 2.3522, 1996, 2025, "09-21")

        self.assertEqual(len(result), 30)
        self.assertEqual(result[0]["an"], 1996)
        self.assertEqual(result[-1]["an"], 2025)
        get.assert_called_once()
        params = get.call_args.kwargs["params"]
        self.assertEqual(params["start_date"], "1996-01-01")
        self.assertEqual(params["end_date"], "2025-12-31")
        self.assertEqual(params["models"], "era5_land")



class NotificationCopyTests(unittest.TestCase):
    @staticmethod
    def forecast():
        return {
            "daily": {
                "temperature_2m_max": [14, 18, 20],
                "temperature_2m_min": [5, 9, 11],
                "weather_code": [2, 61, 80],
                "precipitation_probability_max": [10, 70, 60],
                "uv_index_max": [2, 3, 3],
                "wind_gusts_10m_max": [15, 20, 25],
            }
        }

    def test_daily_notification_uses_natural_copy_without_arrows(self):
        title, body = meteo._compune_rezumat(
            self.forecast(), "dimineata", "ro", "C", "Moreni")
        self.assertEqual(title, "Moreni | Ploaie slabă")
        self.assertIn("maxima va fi de 18°C", body)
        self.assertIn("minima de 9°C", body)
        self.assertNotIn("↑", body)
        self.assertNotIn("↓", body)

    def test_warning_copy_is_semantic_and_complete(self):
        body = meteo._rezumat_scurt_avertizare({
            "fenomene": "conform textelor;",
            "mesaj": (
                "<p>Fenomene vizate: intensificări ale vântului, "
                "răcire accentuată, ploi moderate</p>"
                "<p>Zone afectate: conform hărții</p>"
                "<p>Mai târziu pot apărea descărcări electrice.</p>"
            ),
        })
        self.assertEqual(
            body,
            "În județul Dâmbovița sunt prognozate ploi, "
            "intensificări ale vântului și o răcire accentuată.",
        )
        self.assertNotIn("conform", body.lower())
        self.assertNotIn("…", body)


if __name__ == "__main__":
    unittest.main()
