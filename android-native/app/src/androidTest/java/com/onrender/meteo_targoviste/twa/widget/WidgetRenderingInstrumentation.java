package com.onrender.meteo_targoviste.twa.widget;

import android.app.Activity;
import android.app.Instrumentation;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.text.Layout;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;
import android.widget.ImageView;
import com.onrender.meteo_targoviste.twa.R;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/** Exercises actual RemoteViews on Android without external requests or test libraries. */
public final class WidgetRenderingInstrumentation extends Instrumentation {
    private int checks;
    private final List<Bitmap> samples = new ArrayList<>();

    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            java.util.concurrent.atomic.AtomicReference<Throwable> failure = new java.util.concurrent.atomic.AtomicReference<>();
            runOnMainSync(() -> {
                try { verify(); } catch (Throwable error) { failure.set(error); }
            });
            if (failure.get() != null) throw failure.get();
            result.putString("stream", "PASS: " + checks + " Android widget checks; preview saved.\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            result.putString("stream", "FAIL: " + android.util.Log.getStackTraceString(error));
            finish(Activity.RESULT_CANCELED, result);
        }
    }

    private void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
        checks++;
    }

    private void verify() throws Exception {
        Context base = getTargetContext();
        AppWidgetProviderInfo provider = null;
        int meteoProviders = 0;
        for (AppWidgetProviderInfo info : AppWidgetManager.getInstance(base).getInstalledProviders()) {
            if (info.provider.getPackageName().equals(base.getPackageName())) {
                meteoProviders++;
                require(info.updatePeriodMillis == 0,
                        "no duplicate Android timer for " + info.provider.getClassName());
            }
            if (info.provider.getPackageName().equals(base.getPackageName())
                    && info.provider.getClassName().endsWith("MeteoCapsuleWidget")) provider = info;
        }
        require(meteoProviders == 5, "all five providers use the shared scheduler only");
        require(provider != null, "2x1 provider must be discoverable by launcher");
        require(provider.targetCellWidth == 2 && provider.targetCellHeight == 1, "grid size");
        require(provider.updatePeriodMillis == 0, "single shared scheduler, no second timer");
        require(provider.configure.getClassName().endsWith("WidgetConfigActivity"), "native city selector");
        int[] previews = {R.layout.widget_compact, R.layout.widget_details, R.layout.widget_meteo,
                R.layout.widget_glass_medium, R.layout.widget_capsule, R.layout.widget_capsule_short};
        int[] previewNames = {R.id.compact_oras, R.id.details_oras, R.id.forecast_oras,
                R.id.glass_oras, R.id.capsule_oras, R.id.capsule_oras};
        for (int i = 0; i < previews.length; i++) {
            View preview = new RemoteViews(base.getPackageName(), previews[i]).apply(base, new FrameLayout(base));
            require("Vremea mea".contentEquals(((TextView) preview.findViewById(previewNames[i])).getText()),
                    "all widget previews must say Vremea mea");
        }
        Method build = WeatherWidgetUpdater.class.getDeclaredMethod("buildCapsule", Context.class,
                JSONObject.class, int.class, WidgetPreferences.Location.class);
        build.setAccessible(true);
        Method layout = WeatherWidgetUpdater.class.getDeclaredMethod("capsuleLayout", Context.class,
                JSONObject.class, int.class, WidgetPreferences.Location.class, int.class);
        layout.setAccessible(true);
        WidgetPreferences.Location city = new WidgetPreferences.Location("New York City", "New York", "US", 40.71, -74.01);
        String[] themes = {"zi", "noapte", "apus", "noros", "ploaie", "furtuna", "ninsoare", "ceata"};
        int[][] sizes = {{110,40}, {130,72}, {130,78}, {160,100}, {180,86}, {269,51}, {300,120}};
        for (float font : new float[]{1f, 1.3f, 2f}) {
            Configuration config = new Configuration(base.getResources().getConfiguration());
            config.fontScale = font;
            Context context = base.createConfigurationContext(config);
            for (String theme : themes) {
                String icon = theme.equals("ploaie") ? "ploaie" : theme.equals("furtuna") ? "furtuna"
                        : theme.equals("ninsoare") ? "ninsoare" : theme.equals("ceata") ? "ceata" : "partial";
                JSONObject data = new JSONObject().put("oras", city.city).put("tempText", "-19°")
                        .put("fundal", theme).put("icon", icon).put("descriere", "Parțial noros")
                        .put("minAzi", -24).put("maxAzi", -12);
                // Also build the responsive wrapper itself: both children must support every action.
                RemoteViews responsive = (RemoteViews) build.invoke(null, context, data, 991, city);
                require(responsive != null, "responsive views");
                for (int[] size : sizes) {
                    boolean shortRow = size[1] < 72;
                    RemoteViews views = (RemoteViews) layout.invoke(null, context, data, 991, city,
                            shortRow ? R.layout.widget_capsule_short : R.layout.widget_capsule);
                    FrameLayout parent = new FrameLayout(context);
                    View view = views.apply(context, parent);
                    view.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
                    float density = context.getResources().getDisplayMetrics().density;
                    int width = Math.round(size[0] * density), height = Math.round(size[1] * density);
                    // TextView autosizing requests another layout, as in a real attached host.
                    for (int pass = 0; pass < 3; pass++) {
                        view.forceLayout();
                        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
                        view.layout(0, 0, width, height);
                    }
                    TextView temp = view.findViewById(R.id.capsule_temp);
                    TextView name = view.findViewById(R.id.capsule_oras);
                    require("-19°".contentEquals(temp.getText()), "actual temperature including minus");
                    require(city.city.contentEquals(name.getText()), "correct city, not default city");
                    require(name.getCompoundDrawablesRelative()[0] != null, "location pin");
                    Layout text = temp.getLayout();
                    require(text != null && text.getEllipsisCount(0) == 0
                            && text.getLineWidth(0) <= temp.getWidth(), "temperature must fit " + size[0] + "x" + size[1]);
                    require(temp.getHeight() >= text.getHeight(), "temperature height must fit " + size[0] + "x" + size[1]
                            + ", font " + font + ": " + temp.getHeight() + " < " + text.getHeight());
                    require(view.findViewById(R.id.capsule_root).hasOnClickListeners() && name.hasOnClickListeners(), "open-city and configure actions");
                    if (size[0] >= 160 && size[1] >= 100) {
                        Layout lines = name.getLayout();
                        require(lines.getEllipsisCount(lines.getLineCount() - 1) == 0, "full New York City in spacious widget");
                    }
                    if (font == 1f && size[0] == 180 && (theme.equals("zi") || theme.equals("noapte") || theme.equals("ploaie"))) {
                        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                        view.draw(new Canvas(bitmap));
                        samples.add(bitmap);
                    }
                }
            }
        }
        RemoteViews offline = (RemoteViews) layout.invoke(null, base, null, 991, city, R.layout.widget_capsule);
        View empty = offline.apply(base, new FrameLayout(base));
        require("--°".contentEquals(((TextView) empty.findViewById(R.id.capsule_temp)).getText()), "missing data is not zero degrees");
        require(empty.findViewById(R.id.capsule_root).getContentDescription().toString().contains("Fără conexiune"), "offline accessible status");
        JSONObject data = new JSONObject().put("oras", city.city).put("tempText", "19°")
                .put("icon", "partial").put("fundal", "noapte").put("minAzi", 16).put("maxAzi", 24);
        Method iconMethod = WeatherWidgetUpdater.class.getDeclaredMethod("iconForCurrent", JSONObject.class);
        iconMethod.setAccessible(true);
        require((Integer) iconMethod.invoke(null, data) == R.drawable.ic_w_moon_cloud, "night uses moon and clouds");
        Method background = WeatherWidgetUpdater.class.getDeclaredMethod("backgroundFor", JSONObject.class);
        background.setAccessible(true);
        int[][] wet = {{51, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {53, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {55, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {56, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {57, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {61, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {63, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {65, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {66, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {67, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {68, R.drawable.ic_w_lapovita, R.drawable.widget_weather_snow},
                {69, R.drawable.ic_w_lapovita, R.drawable.widget_weather_snow},
                {71, R.drawable.ic_w_ninsoare, R.drawable.widget_weather_snow},
                {73, R.drawable.ic_w_ninsoare, R.drawable.widget_weather_snow},
                {75, R.drawable.ic_w_ninsoare, R.drawable.widget_weather_snow},
                {77, R.drawable.ic_w_ninsoare, R.drawable.widget_weather_snow},
                {80, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {81, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {82, R.drawable.ic_w_ploaie, R.drawable.widget_weather_rain},
                {85, R.drawable.ic_w_ninsoare, R.drawable.widget_weather_snow},
                {86, R.drawable.ic_w_ninsoare, R.drawable.widget_weather_snow},
                {95, R.drawable.ic_w_furtuna, R.drawable.widget_weather_storm},
                {96, R.drawable.ic_w_furtuna, R.drawable.widget_weather_storm},
                {99, R.drawable.ic_w_furtuna, R.drawable.widget_weather_storm},
                {45, R.drawable.ic_w_ceata, R.drawable.widget_weather_fog},
                {48, R.drawable.ic_w_ceata, R.drawable.widget_weather_fog}};
        for (int[] weather : wet) {
            for (String theme : themes) {
                for (int day : new int[]{0, 1}) {
                    JSONObject current = new JSONObject().put("weatherCode", weather[0])
                            .put("isDay", day).put("fundal", theme).put("icon", "partial");
                    require((Integer) iconMethod.invoke(null, current) == weather[1],
                            "condition must override conflicting night/sunset icon: " + weather[0]);
                    require((Integer) background.invoke(null, current) == weather[2],
                            "condition must override conflicting night/sunset background: " + weather[0]);
                }
            }
        }
        for (String theme : themes) {
            require((Integer) iconMethod.invoke(null, new JSONObject().put("weatherCode", 3)
                    .put("isDay", 0).put("fundal", theme).put("icon", "partial")) == R.drawable.ic_w_nor,
                    "overcast does not show a moon or sun");
        }
        require((Integer) iconMethod.invoke(null, new JSONObject().put("icon", "ploaie")
                .put("fundal", "apus")) == R.drawable.ic_w_ploaie, "older cached rainy payload at sunset");
        String[] builders = {"buildCompact", "buildDetails", "buildForecast", "buildGlass", "buildCapsule"};
        int[] cityIds = {R.id.compact_oras, R.id.details_oras, R.id.forecast_oras, R.id.glass_oras, R.id.capsule_oras};
        int[] iconIds = {R.id.compact_icon, R.id.details_icon, R.id.forecast_icon, R.id.glass_icon, R.id.capsule_icon};
        data.put("weatherCode", 63).put("isDay", 0); // Moreni repro: previous icon was partly cloudy.
        for (int i = 0; i < builders.length; i++) {
            Method existing = WeatherWidgetUpdater.class.getDeclaredMethod(builders[i], Context.class,
                    JSONObject.class, int.class, WidgetPreferences.Location.class);
            existing.setAccessible(true);
            RemoteViews views = (RemoteViews) existing.invoke(null, base, data, 992 + i, city);
            View oldWidget = views.apply(base, new FrameLayout(base));
            require((i == 4 ? "New York City" : "NEW YORK CITY").contentEquals(((TextView) oldWidget.findViewById(cityIds[i])).getText()),
                    "existing widget still renders its own city: " + builders[i]);
            Drawable actual = ((ImageView) oldWidget.findViewById(iconIds[i])).getDrawable();
            require(renderIcon(actual).sameAs(renderIcon(base.getDrawable(R.drawable.ic_w_ploaie))),
                    "rain must render in all five widgets: " + builders[i]);
        }
        Method details = WeatherWidgetUpdater.class.getDeclaredMethod("detailsLayout", Context.class,
                JSONObject.class, int.class, WidgetPreferences.Location.class, int.class);
        details.setAccessible(true);
        for (float font : new float[]{1f, 1.3f, 2f}) {
            Configuration cfg = new Configuration(base.getResources().getConfiguration()); cfg.fontScale = font;
            Context context = base.createConfigurationContext(cfg);
            for (int[] size : new int[][]{{250,110},{300,180},{390,210}}) {
                JSONObject sample = new JSONObject().put("oras","Moreni").put("tempText","11°")
                        .put("descriere","Parțial noros").put("weatherCode",2).put("isDay",0)
                        .put("fundal","noapte").put("minAzi",6).put("maxAzi",11)
                        .put("resimtit",10).put("umiditate",50).put("vant",2).put("actualizat","19:35");
                RemoteViews rv = (RemoteViews)details.invoke(null,context,sample,993,city,
                        size[1]<180 ? R.layout.widget_details_short : R.layout.widget_details);
                View widget = rv.apply(context,new FrameLayout(context));
                widget.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
                float density=context.getResources().getDisplayMetrics().density;
                int w=Math.round(size[0]*density),h=Math.round(size[1]*density);
                for(int pass=0;pass<3;pass++){
                    widget.forceLayout();widget.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),
                            View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));widget.layout(0,0,w,h);
                }
                android.graphics.Rect range=new android.graphics.Rect(), metrics=new android.graphics.Rect();
                widget.findViewById(R.id.details_maxmin).getDrawingRect(range);
                ((android.view.ViewGroup)widget).offsetDescendantRectToMyCoords(widget.findViewById(R.id.details_maxmin),range);
                widget.findViewById(R.id.details_metrics).getDrawingRect(metrics);
                ((android.view.ViewGroup)widget).offsetDescendantRectToMyCoords(widget.findViewById(R.id.details_metrics),metrics);
                require(range.bottom <= metrics.top,"min/max must not overlap metrics "+size[0]+"x"+size[1]+" font "+font);
                for(int textId:new int[]{R.id.details_temp,R.id.details_desc,R.id.details_maxmin,R.id.details_feels,R.id.details_humidity,R.id.details_wind}){
                    TextView tv=widget.findViewById(textId);
                    require(tv.getLayout()!=null && tv.getLayout().getHeight()<=tv.getHeight(),
                            "details text height "+textId+" "+size[0]+"x"+size[1]+" font "+font);
                    require(tv.getLayout().getEllipsisCount(0)==0,"details text complete "+textId);
                }
                require("10°".contentEquals(((TextView)widget.findViewById(R.id.details_feels)).getText()),"metric value has separate label");
                if(font==1f && size[0]==390){
                    Bitmap shot=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);widget.draw(new Canvas(shot));
                    try(FileOutputStream file=new FileOutputStream(new File(base.getExternalFilesDir(null),"widget-details-20261024.png"))){shot.compress(Bitmap.CompressFormat.PNG,100,file);}
                }
            }
        }
        Bitmap preview = Bitmap.createBitmap(samples.get(0).getWidth() + 80, samples.get(0).getHeight() * 3 + 160,
                Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(preview);
        canvas.drawColor(Color.rgb(15, 23, 42));
        int y = 40;
        for (Bitmap sample : samples) { canvas.drawBitmap(sample, 40, y, null); y += sample.getHeight() + 40; }
        try (FileOutputStream out = new FileOutputStream(new File(base.getExternalFilesDir(null), "widget-2x1-preview.png"))) {
            preview.compress(Bitmap.CompressFormat.PNG, 100, out);
        }
    }

    private Bitmap renderIcon(Drawable icon) {
        Bitmap bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888);
        icon.setBounds(0, 0, 96, 96);
        icon.draw(new Canvas(bitmap));
        return bitmap;
    }
}
