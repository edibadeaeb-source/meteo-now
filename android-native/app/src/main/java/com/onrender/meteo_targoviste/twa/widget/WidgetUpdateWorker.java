package com.onrender.meteo_targoviste.twa.widget;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Actualizează toate widgeturile în fundal, fără buton manual. */
public final class WidgetUpdateWorker extends Worker {

    public WidgetUpdateWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        if (!WidgetUpdateScheduler.hasWidgets(getApplicationContext())) {
            return Result.success();
        }
        WeatherWidgetUpdater.refreshFromWorker(getApplicationContext());
        return Result.success();
    }
}
