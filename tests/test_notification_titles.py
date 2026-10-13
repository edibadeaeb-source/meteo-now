import unittest
import test_ai_context as fixtures
from notification_weather import city_title, warning_title

meteo = fixtures.meteo


class NotificationTitleTests(unittest.TestCase):
    def forecast(self, code=2, hours=None):
        return fixtures.NotificationCopyTests.event_forecast(code, 0, hours,
            [90 if c in (61,63,65,71,73,75,80,81,82,85,86) else 5 for c in hours] if hours else None)

    def test_routine_city_header_preserves_condition_and_day_in_body(self):
        for language, today, tomorrow, condition in [('ro','Astăzi:','Mâine:','ploaie slabă'),('en','Today:','Tomorrow:','light rain')]:
            for moment, prefix in [('dimineata',today),('seara',tomorrow)]:
                with self.subTest(language=language,moment=moment):
                    title, body = meteo._compune_rezumat(fixtures.NotificationCopyTests.forecast(),moment,language,'C','New York City')
                    self.assertEqual(title,'NEW YORK CITY')
                    self.assertTrue(body.startswith(prefix))
                    self.assertIn('°C',body)
                    if moment == 'dimineata':
                        self.assertIn(condition,body)
                    self.assertNotIn('|',title)
        self.assertEqual(city_title(' Târgoviște '),'TÂRGOVIȘTE')

    def test_event_headlines_cover_current_and_future_conditions(self):
        cases = [
            (self.forecast(63,[63]*6),'rain_now','Plouă acum în Moreni'),
            (self.forecast(2,[2,61,61,61,61,61]),'rain_start','Se apropie ploaia de Moreni'),
            (self.forecast(63),'rain_end','Ploaia se oprește curând în Moreni'),
            (self.forecast(73,[73]*6),'snow_now','Ninge acum în Moreni'),
            (self.forecast(2,[2,73,73,73,73,73]),'snow_start','Se apropie ninsoarea de Moreni'),
            (self.forecast(73),'snow_end','Ninsoarea se oprește curând în Moreni'),
            (self.forecast(95),'storm_now','Furtună în Moreni'),
            (self.forecast(2,[2,95,95,95,95,95]),'storm_start','Risc de furtună în Moreni'),
            (self.forecast(45),'fog_now','Ceață în Moreni'),
            (self.forecast(2,[2,45,45,45,45,45]),'fog_start','Se anunță ceață în Moreni'),
        ]
        wind_now=self.forecast();wind_now['current']['wind_gusts_10m']=70
        wind_future=self.forecast();wind_future['hourly']['wind_gusts_10m']=[10,70,70,70,70,70]
        cases.extend([(wind_now,'wind_now','Vânt puternic în Moreni'),(wind_future,'wind_start','Se anunță vânt puternic în Moreni')])
        for data,kind,title in cases:
            with self.subTest(kind=kind):
                event=meteo._compune_eveniment_meteo(data,'ro','C','Moreni')
                self.assertEqual(event['kind'],kind);self.assertEqual(event['title'],title)
                self.assertNotIn('|',event['title']);self.assertTrue(event['body'].endswith('.'))
                english=meteo._compune_eveniment_meteo(data,'en','F','New York City')
                self.assertIn('New York City',english['title']);self.assertNotIn('Moreni',english['title'])
                self.assertNotIn('|',english['title'])

    def test_later_rain_end_is_not_called_soon(self):
        data=fixtures.NotificationCopyTests.event_forecast(63,.7,[63,63,2,2,2,2],[90,90,10,5,5,5])
        for language,forbidden in [('ro','curând'),('en','soon')]:
            event=meteo._compune_eveniment_meteo(data,language,'C','Târgoviște')
            self.assertNotIn(forbidden,event['title']);self.assertIn('Târgoviște',event['title'])

    def test_official_warning_titles_keep_severity_and_full_city(self):
        for level,color in [(1,'galben'),(2,'portocaliu'),(3,'roșu')]:
            self.assertEqual(warning_title('Târgoviște',level),f'Cod {color} pentru Târgoviște')
            self.assertNotIn('|',warning_title('New York City',level,'en'))
        self.assertEqual(warning_title('Moreni',9),'Avertizare meteo pentru Moreni')


if __name__ == '__main__':
    unittest.main()
