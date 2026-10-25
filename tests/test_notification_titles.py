import unittest
from datetime import datetime, timedelta
import test_ai_context as fixtures
from notification_weather import city_title, warning_title, weather_emoji

meteo = fixtures.meteo


class NotificationTitleTests(unittest.TestCase):
    def forecast(self, code=2, hours=None):
        return fixtures.NotificationCopyTests.event_forecast(code, 0, hours,
            [90 if c in (61,63,65,71,73,75,80,81,82,85,86) else 5 for c in hours] if hours else None)

    def test_daily_city_emoji_and_short_body_keep_target_day_and_temperatures(self):
        for language, today, tomorrow, condition in [('ro','Astăzi:','Mâine:','ploaie slabă'),('en','Today:','Tomorrow:','light rain')]:
            for moment, prefix in [('dimineata',today),('seara',tomorrow)]:
                with self.subTest(language=language,moment=moment):
                    title, body = meteo._compune_rezumat(fixtures.NotificationCopyTests.forecast(),moment,language,'C','New York City')
                    self.assertEqual(title,'New York City 🌧️')
                    self.assertTrue(body.startswith(prefix))
                    self.assertIn('°C',body)
                    self.assertLess(len(body),100)
                    if moment == 'dimineata':
                        self.assertIn(condition,body)
                    self.assertNotIn('|',title)
        self.assertEqual(city_title(' Târgoviște '),'Târgoviște 🔔')

    def test_event_headers_cover_all_current_and_future_conditions(self):
        cases = [
            (self.forecast(63,[63]*6),'rain_now','🌧️'),
            (self.forecast(2,[2,61,61,61,61,61]),'rain_start','🌧️'),
            (self.forecast(63),'rain_end','🌧️'),
            (self.forecast(73,[73]*6),'snow_now','❄️'),
            (self.forecast(2,[2,73,73,73,73,73]),'snow_start','❄️'),
            (self.forecast(73),'snow_end','❄️'),
            (self.forecast(95),'storm_now','⛈️'),
            (self.forecast(2,[2,95,95,95,95,95]),'storm_start','⛈️'),
            (self.forecast(45),'fog_now','☁️'),
            (self.forecast(2,[2,45,45,45,45,45]),'fog_start','☁️'),
        ]
        wind_now=self.forecast();wind_now['current']['wind_gusts_10m']=70
        wind_future=self.forecast();wind_future['hourly']['wind_gusts_10m']=[10,70,70,70,70,70]
        cases.extend([(wind_now,'wind_now','💨'),(wind_future,'wind_start','💨')])
        for data,kind,symbol in cases:
            for language,unit,city in [('ro','C','Moreni'),('en','F','New York City')]:
                with self.subTest(kind=kind,language=language):
                    event=meteo._compune_eveniment_meteo(data,language,unit,city)
                    self.assertEqual(event['kind'],kind)
                    self.assertEqual(event['title'],city+' '+symbol)
                    self.assertTrue(event['body'].endswith('.'))
                    self.assertLess(len(event['body']),110)
                    self.assertNotIn('…',event['body'])

    def test_short_daily_summary_keeps_fahrenheit_conversion(self):
        title,body=meteo._compune_rezumat(fixtures.NotificationCopyTests.forecast(),'dimineata','en','F','Moreni')
        self.assertEqual(title,'Moreni 🌧️')
        self.assertEqual(body,'Today: light rain. High 64°F, low 48°F.')

    def test_showers_match_example_without_renaming_all_rain_as_showers(self):
        for code,expected in [(80,'Averse posibile în următoarea oră.'),(61,'Ploaie posibilă în următoarea oră.')]:
            event=meteo._compune_eveniment_meteo(self.forecast(2,[2,code,code,code,code,code]),'ro','C','Moreni')
            self.assertEqual(event['title'],'Moreni 🌧️')
            self.assertEqual(event['body'],expected)

    def test_later_rain_end_is_not_within_next_hour(self):
        data=fixtures.NotificationCopyTests.event_forecast(63,.7,[63,63,2,2,2,2],[90,90,10,5,5,5])
        event=meteo._compune_eveniment_meteo(data,'ro','C','Târgoviște')
        self.assertEqual(event['body'],'Ploaia s-ar putea opri în această seară.')
        now=datetime.fromisoformat('2026-09-22T19:22:00+03:00')
        self.assertEqual(meteo._moment_eveniment(now+timedelta(minutes=60),now,'ro'),'în următoarea oră')
        self.assertNotIn('următoarea oră',meteo._moment_eveniment(now+timedelta(minutes=61),now,'ro'))
        self.assertNotIn('next hour',meteo._moment_eveniment(now+timedelta(minutes=75),now,'en'))

    def test_overnight_timing_uses_city_clock(self):
        now=datetime.fromisoformat('2026-09-22T22:22:00-04:00')
        target=datetime.fromisoformat('2026-09-23T00:00:00-04:00')
        self.assertEqual(meteo._moment_eveniment(target,now,'ro'),'în cursul nopții')
        self.assertEqual(meteo._moment_eveniment(target,now,'en'),'tonight')

    def test_day_night_and_weather_symbols(self):
        self.assertEqual(weather_emoji(0,True),'☀️')
        self.assertEqual(weather_emoji(0,False),'🌙')
        self.assertEqual(weather_emoji(2,False),'☁️')
        for code,symbol in [(3,'☁️'),(45,'☁️'),(57,'🌧️'),(67,'🌧️'),(69,'🌧️'),(77,'❄️'),(86,'❄️'),(99,'⛈️'),(None,'🌦️')]:
            self.assertEqual(weather_emoji(code),symbol)
        data=fixtures.NotificationCopyTests.forecast();data['daily']['weather_code'][2]=0
        self.assertEqual(meteo._compune_rezumat(data,'seara','ro','C','Moreni')[0],'Moreni ☀️')

    def test_warning_severity_moves_into_short_body_in_both_languages(self):
        for level,ro,en in [(1,'Cod galben','Yellow warning'),(2,'Cod portocaliu','Orange warning'),(3,'Cod roșu','Red warning')]:
            for language,prefix in [('ro',ro),('en',en)]:
                warning={'nivel':level,'fenomene':'ploi și intensificări ale vântului'}
                self.assertEqual(warning_title('Târgoviște',level,language),'Târgoviște ⚠️')
                body=meteo._rezumat_scurt_avertizare(warning,compact=True,limba=language)
                self.assertTrue(body.startswith(prefix+': '))
                self.assertLess(len(body),100)
                self.assertNotIn('…',body)
        self.assertEqual(meteo._rezumat_scurt_avertizare({'nivel':3},compact=True),'Cod roșu: verifică avertizarea ANM.')


if __name__ == '__main__':
    unittest.main()
