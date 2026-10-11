package com.onrender.meteo_targoviste.twa;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.NotificationManagerCompat;
import com.onrender.meteo_targoviste.twa.widget.WidgetCitySync;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Publishes only the permission result; the widget encryption key stays on-device. */
public final class NativeNotificationStatus {
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private NativeNotificationStatus() { }

    public static boolean allowed(Context context) {
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
                && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(
                Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
    }

    public static void publish(Context supplied, String nonce, Runnable done) {
        Context context = supplied.getApplicationContext();
        if (nonce == null || !nonce.matches("[a-f0-9]{32}")) {
            done.run();
            return;
        }
        final String status = allowed(context) ? "granted" : "denied";
        IO.execute(() -> {
            HttpURLConnection connection = null;
            try {
                String token = WidgetCitySync.appendToken(context,
                        Uri.parse("https://meteo-now.onrender.com/")).getQueryParameter("nativeWidgetToken");
                byte[] digest = MessageDigest.getInstance("SHA-256").digest(
                        ("METEO-NOW-notification-status:" + token).getBytes(StandardCharsets.UTF_8));
                StringBuilder id = new StringBuilder();
                for (byte b : digest) id.append(String.format("%02x", b & 255));
                JSONObject body = new JSONObject();
                body.put("id", id.toString());
                body.put("requestId", nonce);
                body.put("status", status);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                connection = (HttpURLConnection) new URL(
                        "https://meteo-now.onrender.com/api/push/android-status").openConnection();
                connection.setConnectTimeout(3500);
                connection.setReadTimeout(3500);
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream out = connection.getOutputStream()) { out.write(bytes); }
                connection.getResponseCode();
            } catch (Exception ignored) {
                // The web page reports an unconfirmed result and preserves an existing subscription.
            } finally {
                if (connection != null) connection.disconnect();
                new Handler(Looper.getMainLooper()).post(done);
            }
        });
    }
}
