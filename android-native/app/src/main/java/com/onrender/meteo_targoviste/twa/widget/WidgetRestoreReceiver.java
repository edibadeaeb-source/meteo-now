package com.onrender.meteo_targoviste.twa.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Reface actualizarea automată după evenimente de sistem pe care unele
 * launchere și economizoare de baterie le tratează diferit.
 */
public final class WidgetRestoreReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!WidgetUpdateScheduler.hasWidgets(context)) return;
        WidgetUpdateScheduler.ensureScheduled(context);
        WeatherWidgetUpdater.requestUpdate(context);
    }
}
