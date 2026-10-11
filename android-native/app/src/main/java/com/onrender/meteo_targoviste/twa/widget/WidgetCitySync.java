package com.onrender.meteo_targoviste.twa.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Punte criptată între lista de orașe a PWA-ului și configuratorul nativ.
 * Tokenul/cheia rămâne pe telefon; serverul primește doar un pachet AES-GCM opac.
 */
public final class WidgetCitySync {

    private static final String PREFS = "meteo_widget";
    private static final String TOKEN_KEY = "widget_sync_token_v1";
    private static final String ENDPOINT = "https://meteo-now.onrender.com/api/widget/cities";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    public interface Callback {
        void onComplete(boolean updated);
    }

    private WidgetCitySync() { }

    public static Uri appendToken(Context context, Uri uri) {
        if (uri == null || uri.getQueryParameter("nativeWidgetToken") != null) return uri;
        return uri.buildUpon()
                .appendQueryParameter("nativeWidgetToken", token(context))
                .build();
    }

    public static void refresh(Context suppliedContext, Callback callback) {
        Context context = suppliedContext.getApplicationContext();
        EXECUTOR.execute(() -> {
            boolean updated = false;
            try {
                String token = token(context);
                String syncId = hex(digest("METEO-NOW-widget-id:" + token));
                HttpURLConnection connection = (HttpURLConnection)
                        new URL(ENDPOINT + "?id=" + syncId).openConnection();
                try {
                    connection.setConnectTimeout(10000);
                    connection.setReadTimeout(10000);
                    connection.setUseCaches(false);
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty("User-Agent", "MeteoNowWidget/4.0");
                    if (connection.getResponseCode() == HttpURLConnection.HTTP_OK) {
                        StringBuilder body = new StringBuilder();
                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                                connection.getInputStream(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) body.append(line);
                        }
                        JSONObject envelope = new JSONObject(body.toString())
                                .optJSONObject("envelope");
                        if (envelope != null) {
                            List<WidgetPreferences.Location> cities =
                                    decryptCities(token, envelope);
                            WidgetPreferences.replaceSyncedLocations(context, cities);
                            updated = true;
                        }
                    }
                } finally {
                    connection.disconnect();
                }
            } catch (Exception ignored) { }

            boolean result = updated;
            if (callback != null) MAIN.post(() -> callback.onComplete(result));
        });
    }

    private static List<WidgetPreferences.Location> decryptCities(
            String token, JSONObject envelope) throws Exception {
        byte[] iv = Base64.decode(envelope.getString("iv"), Base64.DEFAULT);
        byte[] encrypted = Base64.decode(envelope.getString("ciphertext"), Base64.DEFAULT);
        if (iv.length != 12 || encrypted.length < 17 || encrypted.length > 12288) {
            throw new IllegalArgumentException("Invalid encrypted city list");
        }

        byte[] key = digest("METEO-NOW-widget-key:" + token);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
                new GCMParameterSpec(128, iv));
        String clear = new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        JSONObject payload = new JSONObject(clear);
        if (payload.optInt("v") != 1) throw new IllegalArgumentException("Unsupported version");

        JSONArray items = payload.optJSONArray("cities");
        List<WidgetPreferences.Location> cities = new ArrayList<>();
        if (items == null) return cities;
        for (int i = 0; i < items.length() && cities.size() < 12; i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String city = item.optString("city", "").trim();
            double lat = item.optDouble("lat", Double.NaN);
            double lon = item.optDouble("lon", Double.NaN);
            if (city.isEmpty() || city.length() > 60 || Double.isNaN(lat)
                    || Double.isNaN(lon) || lat < -90 || lat > 90
                    || lon < -180 || lon > 180) continue;
            cities.add(new WidgetPreferences.Location(
                    city,
                    trim(item.optString("admin", ""), 60),
                    trim(item.optString("country", ""), 3),
                    lat, lon));
        }
        return cities;
    }

    private static synchronized String token(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String current = prefs.getString(TOKEN_KEY, "");
        if (current != null && current.matches("[A-Za-z0-9_-]{24,96}")) return current;
        String generated = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
        prefs.edit().putString(TOKEN_KEY, generated).commit();
        return generated;
    }

    private static byte[] digest(String value) throws Exception {
        return MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) out.append(String.format("%02x", value & 0xff));
        return out.toString();
    }

    private static String trim(String value, int limit) {
        String result = value == null ? "" : value.trim();
        return result.length() <= limit ? result : result.substring(0, limit);
    }
}
