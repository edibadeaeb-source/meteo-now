package com.onrender.meteo_targoviste.twa.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

/** Comportament comun pentru toate dimensiunile widgetului METEO NOW. */
public abstract class BaseMeteoWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        WidgetUpdateScheduler.ensureScheduled(context);
        WeatherWidgetUpdater.requestUpdate(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetUpdateScheduler.ensureScheduled(context);
        WeatherWidgetUpdater.requestUpdate(context);
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            WidgetPreferences.delete(context, appWidgetId);
        }
        super.onDeleted(context, appWidgetIds);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        WidgetUpdateScheduler.sync(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (WeatherWidgetUpdater.ACTION_REFRESH.equals(intent.getAction())) {
            WeatherWidgetUpdater.requestUpdate(context);
            return;
        }
        super.onReceive(context, intent);
    }
}
