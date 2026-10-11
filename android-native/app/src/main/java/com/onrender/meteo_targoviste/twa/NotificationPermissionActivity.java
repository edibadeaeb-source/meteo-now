package com.onrender.meteo_targoviste.twa;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.provider.Settings;

import com.google.androidbrowserhelper.trusted.PrefUtils;

public class NotificationPermissionActivity extends Activity {
    private static final int CERERE_NOTIFICARI = 1202;
    private String nonce;
    private boolean waitingForSettings;
    private boolean publishing;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri data = getIntent().getData();
        nonce = data == null ? null : data.getQueryParameter("requestId");
        boolean cere = data != null
                && data.getPath() != null
                && data.getPath().contains("request");

        if (cere
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
            PrefUtils.setHasRequestedNotificationPermission(this);
            if (getPreferences(MODE_PRIVATE).getBoolean("asked", false)
                    && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                waitingForSettings = true;
                startActivityForResult(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()), CERERE_NOTIFICARI);
                return;
            }
            getPreferences(MODE_PRIVATE).edit().putBoolean("asked", true).apply();
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    CERERE_NOTIFICARI
            );
            return;
        }

        // TWA este deja sub această activitate. Nu relansăm LauncherActivity,
        // fiindcă ar închide taskul Chrome; revenim direct la pagina existentă.
        publishAndFinish();
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CERERE_NOTIFICARI) {
            publishAndFinish();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CERERE_NOTIFICARI && waitingForSettings) {
            waitingForSettings = false;
            publishAndFinish();
        }
    }

    private void publishAndFinish() {
        if (publishing) return;
        publishing = true;
        NativeNotificationStatus.publish(this, nonce, this::finish);
    }
}
