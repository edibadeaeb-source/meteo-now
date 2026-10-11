package com.onrender.meteo_targoviste.twa.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/** Menține o singură actualizare automată pentru întreaga familie de widgeturi. */
public final class WidgetUpdateScheduler {

    private static final String UNIQUE_WORK = "meteo-now-widget-refresh-20m";
    private static final long INTERVAL_MINUTES = 20L;

    private WidgetUpdateScheduler() { }

    public static void sync(Context context) {
        if (hasWidgets(context)) ensureScheduled(context);
        else WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK);
    }

    static void ensureScheduled(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                WidgetUpdateWorker.class, INTERVAL_MINUTES, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setInitialDelay(INTERVAL_MINUTES, TimeUnit.MINUTES)
                .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK, ExistingPeriodicWorkPolicy.UPDATE, request);
    }

    static boolean hasWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Class<?>[] providers = {
                MeteoCapsuleWidget.class,
                MeteoCompactWidget.class,
                MeteoDetailsWidget.class,
                MeteoGlassWidget.class,
                MeteoWidget.class
        };
        for (Class<?> provider : providers) {
            if (manager.getAppWidgetIds(new ComponentName(context, provider)).length > 0) {
                return true;
            }
        }
        return false;
    }
}
