package com.onrender.meteo_targoviste.twa.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;

/** Salvează localitatea aleasă separat pentru fiecare instanță de widget. */
final class WidgetPreferences {

    private static final String PREFS = "meteo_widget";
    private static final String PREFIX = "config_";
    // v2 pornește curat: istoricul vechi conținea implicit Târgoviște.
    private static final String MANUAL_LOCATIONS = "manual_locations_v2";
    private static final String SYNCED_LOCATIONS = "synced_locations_v1";
    private static final int MAX_SAVED_LOCATIONS = 12;

    private WidgetPreferences() { }

    static boolean isConfigured(Context context, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.contains(PREFIX + appWidgetId + "_city");
    }

    static Location load(Context context, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String key = PREFIX + appWidgetId + "_";
        String city = prefs.getString(key + "city", "Târgoviște");
        String admin = prefs.getString(key + "admin", "Dâmbovița");
        String country = prefs.getString(key + "country", "RO");
        double lat = parseDouble(prefs.getString(key + "lat", null), 44.9266);
        double lon = parseDouble(prefs.getString(key + "lon", null), 25.4566);
        return new Location(city, admin, country, lat, lon);
    }

    static void save(Context context, int appWidgetId, Location location) {
        String key = PREFIX + appWidgetId + "_";
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(key + "city", location.city)
                .putString(key + "admin", location.admin)
                .putString(key + "country", location.country)
                .putString(key + "lat", Double.toString(location.lat))
                .putString(key + "lon", Double.toString(location.lon))
                .apply();
        remember(context, location);
    }

    /** Orașele salvate în aplicație, urmate de căutările alese explicit în configurator. */
    static List<Location> savedLocations(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        LinkedHashMap<String, Location> unique = new LinkedHashMap<>();
        addAll(unique, readList(prefs, SYNCED_LOCATIONS));
        addAll(unique, readList(prefs, MANUAL_LOCATIONS));
        return new ArrayList<>(unique.values());
    }

    static void replaceSyncedLocations(Context context, List<Location> locations) {
        writeList(context, SYNCED_LOCATIONS, locations);
    }

    private static void remember(Context context, Location newest) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        List<Location> ordered = new ArrayList<>();
        ordered.add(newest);
        for (Location location : readList(prefs, MANUAL_LOCATIONS)) {
            if (!location.cacheKey().equals(newest.cacheKey())) ordered.add(location);
            if (ordered.size() >= MAX_SAVED_LOCATIONS) break;
        }
        writeList(context, MANUAL_LOCATIONS, ordered);
    }

    private static void addAll(LinkedHashMap<String, Location> target, List<Location> source) {
        for (Location location : source) {
            String key = location.cacheKey();
            if (!target.containsKey(key) && target.size() >= MAX_SAVED_LOCATIONS) return;
            target.put(key, location);
        }
    }

    private static List<Location> readList(SharedPreferences prefs, String key) {
        List<Location> result = new ArrayList<>();
        try {
            JSONArray saved = new JSONArray(prefs.getString(key, "[]"));
            for (int i = 0; i < saved.length() && result.size() < MAX_SAVED_LOCATIONS; i++) {
                JSONObject item = saved.optJSONObject(i);
                if (item == null) continue;
                Location location = fromJson(item);
                if (location != null) result.add(location);
            }
        } catch (Exception ignored) { }
        return result;
    }

    private static void writeList(Context context, String key, List<Location> locations) {
        JSONArray saved = new JSONArray();
        LinkedHashMap<String, Location> unique = new LinkedHashMap<>();
        addAll(unique, locations);
        for (Location location : unique.values()) {
            JSONObject item = new JSONObject();
            try {
                item.put("city", location.city);
                item.put("admin", location.admin);
                item.put("country", location.country);
                item.put("lat", location.lat);
                item.put("lon", location.lon);
                saved.put(item);
            } catch (Exception ignored) { }
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(key, saved.toString())
                .apply();
    }

    private static Location fromJson(JSONObject item) {
        String city = item.optString("city", "").trim();
        double lat = item.optDouble("lat", Double.NaN);
        double lon = item.optDouble("lon", Double.NaN);
        if (city.isEmpty() || Double.isNaN(lat) || Double.isNaN(lon)
                || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return null;
        }
        return new Location(city, item.optString("admin", ""),
                item.optString("country", ""), lat, lon);
    }

    static void delete(Context context, int appWidgetId) {
        String key = PREFIX + appWidgetId + "_";
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .remove(key + "city")
                .remove(key + "admin")
                .remove(key + "country")
                .remove(key + "lat")
                .remove(key + "lon")
                .apply();
    }

    private static double parseDouble(String value, double fallback) {
        if (value == null) return fallback;
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    static final class Location {
        final String city;
        final String admin;
        final String country;
        final double lat;
        final double lon;

        Location(String city, String admin, String country, double lat, double lon) {
            this.city = clean(city, "Localitate");
            this.admin = clean(admin, "");
            this.country = clean(country, "").toUpperCase(Locale.ROOT);
            this.lat = lat;
            this.lon = lon;
        }

        String cacheKey() {
            return String.format(Locale.US, "%.4f_%.4f", lat, lon);
        }

        String displayName() {
            StringBuilder name = new StringBuilder(city);
            if (!admin.isEmpty() && !admin.equalsIgnoreCase(city)) name.append(", ").append(admin);
            if (!country.isEmpty()) name.append(" · ").append(country);
            return name.toString();
        }

        private static String clean(String value, String fallback) {
            String result = value == null ? "" : value.trim();
            return result.isEmpty() ? fallback : result;
        }
    }
}
