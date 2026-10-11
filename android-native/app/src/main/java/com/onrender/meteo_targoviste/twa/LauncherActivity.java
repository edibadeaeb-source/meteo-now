package com.onrender.meteo_targoviste.twa;

import android.Manifest;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationManagerCompat;

import com.onrender.meteo_targoviste.twa.widget.WidgetCitySync;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // The starting theme customizes Android 12+; keep the TWA launcher transparent.
        setTheme(R.style.Theme_MeteoNow_Launcher_PostSplash);
        super.onCreate(savedInstanceState);

    }

    private boolean notificariPermise() {
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            return false;
        }
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri uri = super.getLaunchingUrl();
        Uri.Builder builder = uri.buildUpon();
        if (uri.getQueryParameter("nativeNotificationsBridge") == null) {
            builder.appendQueryParameter("nativeNotificationsBridge", "1");
        }
        if (uri.getQueryParameter("source") == null) {
            builder.appendQueryParameter("source", "android-app");
        }
        if (uri.getQueryParameter("androidNotifications") == null) {
            builder.appendQueryParameter(
                    "androidNotifications",
                    notificariPermise() ? "granted" : "denied"
            );
            builder.appendQueryParameter("nativeAction", "status");
        }
        return WidgetCitySync.appendToken(this, builder.build());
    }
}
