package com.onrender.meteo_targoviste.twa.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Only fixed technical categories; never include a city, ID, coordinate or exception text. */
final class WidgetDiagnostics {
    private static final ThreadPoolExecutor REPORTS = new ThreadPoolExecutor(0, 1, 10,
            TimeUnit.SECONDS, new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.DiscardPolicy());

    private WidgetDiagnostics() { }

    static void failed(Context suppliedContext) {
        try {
            Context context = suppliedContext.getApplicationContext();
            ConnectivityManager connectivity = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo network = connectivity == null ? null : connectivity.getActiveNetworkInfo();
            if (network == null || !network.isConnected()) return;
            synchronized (WidgetDiagnostics.class) {
                SharedPreferences prefs = context.getSharedPreferences("meteo_diagnostics", Context.MODE_PRIVATE);
                long now = System.currentTimeMillis();
                long previous = prefs.getLong("widget_failure", 0);
                if (now >= previous && now - previous < 15 * 60 * 1000) return;
                prefs.edit().putLong("widget_failure", now).apply();
            }
            REPORTS.execute(() -> send());
        } catch (Exception ignored) { }
    }

    private static void send() {
        HttpURLConnection connection = null;
        try {
            JSONObject event = new JSONObject();
            event.put("code", "widget_unavailable");
            event.put("component", "widgets");
            event.put("operation", "widget");
            event.put("release", "1.0.22");
            event.put("platform", "android");
            event.put("error", "Other");
            event.put("script", "native");
            byte[] body = event.toString().getBytes(StandardCharsets.UTF_8);
            connection = (HttpURLConnection) new URL("https://meteo-now.onrender.com/api/diagnostics").openConnection();
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(4000);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setFixedLengthStreamingMode(body.length);
            connection.setDoOutput(true);
            try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
            connection.getResponseCode();
        } catch (Exception ignored) {
            // Reporting failure must never alter widget data or retry behavior.
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
