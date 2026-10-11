package com.onrender.meteo_targoviste.twa;

import com.onrender.meteo_targoviste.twa.widget.WidgetUpdateScheduler;

public class Application extends android.app.Application {

    @Override
    public void onCreate() {
        super.onCreate();
        WidgetUpdateScheduler.sync(this);
    }
}
