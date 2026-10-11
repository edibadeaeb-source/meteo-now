package com.onrender.meteo_targoviste.twa.widget;

import android.app.PendingIntent;
import android.os.Build;
import android.util.SizeF;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import com.onrender.meteo_targoviste.twa.LauncherActivity;
import com.onrender.meteo_targoviste.twa.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Descarca o singura data datele si actualizeaza toate dimensiunile widgeturilor. */
final class WeatherWidgetUpdater {

    static final String ACTION_REFRESH =
            "com.onrender.meteo_targoviste.twa.widget.REFRESH";

    private static final String API_URL = "https://meteo-now.onrender.com/api/widget";
    private static final String SITE_URL = "https://meteo-now.onrender.com/";
    private static final String PREFS = "meteo_widget";
    private static final String CACHE_PREFIX = "ultimele_";
    private static final String LEGACY_CACHE_KEY = "ultimele";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean UPDATE_RUNNING = new AtomicBoolean(false);
    private static final AtomicBoolean UPDATE_PENDING = new AtomicBoolean(false);

    private static final int TYPE_COMPACT = 0;
    private static final int TYPE_DETAILS = 1;
    private static final int TYPE_FORECAST = 2;
    private static final int TYPE_GLASS = 3;
    private static final int TYPE_CAPSULE = 4;

    private WeatherWidgetUpdater() { }

    /**
     * Actualizează explicit widgetul abia configurat. În acel moment launcherul
     * poate să nu-l includă încă în getAppWidgetIds(), deci nu așteptăm
     * broadcastul periodic ca să apară orașul ales manual.
     */
    static void configureWidget(final Context suppliedContext, final int appWidgetId) {
        final Context context = suppliedContext.getApplicationContext();
        WidgetUpdateScheduler.ensureScheduled(context);
        final AppWidgetManager manager = AppWidgetManager.getInstance(context);
        final Target target = targetForId(context, manager, appWidgetId);
        if (target == null) {
            requestUpdate(context);
            return;
        }

        JSONObject cached = cachedData(context, target.location);
        if (cached == null) showState(manager, context, target, true);
        else updateTarget(manager, context, target, cached);

        EXECUTOR.execute(() -> {
            JSONObject data = fetchJson(context, target.location);
            if (data == null) showState(manager, context, target, false);
            else updateTarget(manager, context, target, data);
        });
    }

    private static Target targetForId(Context context, AppWidgetManager manager, int appWidgetId) {
        AppWidgetProviderInfo info = manager.getAppWidgetInfo(appWidgetId);
        if (info == null || info.provider == null) return null;
        String provider = info.provider.getClassName();
        int type;
        if (MeteoCompactWidget.class.getName().equals(provider)) type = TYPE_COMPACT;
        else if (MeteoDetailsWidget.class.getName().equals(provider)) type = TYPE_DETAILS;
        else if (MeteoWidget.class.getName().equals(provider)) type = TYPE_FORECAST;
        else if (MeteoGlassWidget.class.getName().equals(provider)) type = TYPE_GLASS;
        else if (MeteoCapsuleWidget.class.getName().equals(provider)) type = TYPE_CAPSULE;
        else return null;
        return new Target(appWidgetId, type, WidgetPreferences.load(context, appWidgetId));
    }

    static void requestUpdate(final Context suppliedContext) {
        final Context context = suppliedContext.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        List<Target> currentTargets = collectTargets(context, manager);
        if (currentTargets.isEmpty()) return;

        // Fiecare instanță își afișează imediat propriul cache și propriul oraș.
        for (Target target : currentTargets) {
            JSONObject cached = cachedData(context, target.location);
            if (cached == null) showState(manager, context, target, true);
            else updateTarget(manager, context, target, cached);
        }

        if (!UPDATE_RUNNING.compareAndSet(false, true)) {
            UPDATE_PENDING.set(true);
            return;
        }
        EXECUTOR.execute(() -> runRefreshLoop(context));
    }

    /** Executată direct de WorkManager pe firul său de fundal. */
    static void refreshFromWorker(Context suppliedContext) {
        Context context = suppliedContext.getApplicationContext();
        if (!UPDATE_RUNNING.compareAndSet(false, true)) {
            UPDATE_PENDING.set(true);
            return;
        }
        runRefreshLoop(context);
    }

    private static void runRefreshLoop(Context context) {
        try {
            do {
                UPDATE_PENDING.set(false);
                refreshAll(context);
            } while (UPDATE_PENDING.getAndSet(false));
        } catch (RuntimeException failure) {
            WidgetDiagnostics.failed(context);
            throw failure;
        } finally {
            UPDATE_RUNNING.set(false);
            if (UPDATE_PENDING.getAndSet(false)) requestUpdate(context);
        }
    }
    private static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        List<Target> targets = collectTargets(context, manager);
        Map<String, List<Target>> groups = new LinkedHashMap<>();
        for (Target target : targets) {
            String key = requestKey(target.location);
            List<Target> group = groups.get(key);
            if (group == null) {
                group = new ArrayList<>();
                groups.put(key, group);
            }
            group.add(target);
        }

        for (List<Target> group : groups.values()) {
            if (group.isEmpty()) continue;
            WidgetPreferences.Location location = group.get(0).location;
            JSONObject data = fetchJson(context, location);
            for (Target target : group) {
                if (data == null) showState(manager, context, target, false);
                else updateTarget(manager, context, target, data);
            }
        }
    }

    private static List<Target> collectTargets(Context context, AppWidgetManager manager) {
        List<Target> targets = new ArrayList<>();
        addTargets(targets, context, manager, MeteoCompactWidget.class, TYPE_COMPACT);
        addTargets(targets, context, manager, MeteoDetailsWidget.class, TYPE_DETAILS);
        addTargets(targets, context, manager, MeteoWidget.class, TYPE_FORECAST);
        addTargets(targets, context, manager, MeteoGlassWidget.class, TYPE_GLASS);
        addTargets(targets, context, manager, MeteoCapsuleWidget.class, TYPE_CAPSULE);
        return targets;
    }

    private static void addTargets(List<Target> targets, Context context,
                                   AppWidgetManager manager, Class<?> provider, int type) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        for (int id : ids) {
            targets.add(new Target(id, type, WidgetPreferences.load(context, id)));
        }
    }

    private static void showState(AppWidgetManager manager, Context context,
                                  Target target, boolean loading) {
        RemoteViews views = viewsFor(context, target, null);
        String city = target.location.city.toUpperCase(Locale.ROOT);
        String state = loading ? "Se încarcă..." : "Fără conexiune";
        if (target.type == TYPE_COMPACT) {
            views.setTextViewText(R.id.compact_oras, city);
            views.setTextViewText(R.id.compact_desc, state);
            views.setTextViewText(R.id.compact_actualizat, loading ? "Acum" : "");
        } else if (target.type == TYPE_DETAILS) {
            views.setTextViewText(R.id.details_oras, city);
            views.setTextViewText(R.id.details_desc, state);
            views.setTextViewText(R.id.details_actualizat, loading ? "Acum" : "");
        } else if (target.type == TYPE_FORECAST) {
            views.setTextViewText(R.id.forecast_oras, city);
            views.setTextViewText(R.id.forecast_desc, state);
            views.setTextViewText(R.id.forecast_actualizat, loading ? "Acum" : "");
        } else if (target.type == TYPE_CAPSULE) {
            views.setTextViewText(R.id.capsule_oras, target.location.city);
            views.setTextViewText(R.id.capsule_maxmin, state);
            views.setContentDescription(R.id.capsule_root, target.location.city + ". " + state);
        } else {
            views.setTextViewText(R.id.glass_oras, city);
            views.setTextViewText(R.id.glass_desc, state);
            views.setTextViewText(R.id.glass_actualizat, loading ? "Acum" : "");
        }
        manager.updateAppWidget(target.id, views);
    }

    private static void updateTarget(AppWidgetManager manager, Context context,
                                     Target target, JSONObject data) {
        manager.updateAppWidget(target.id, viewsFor(context, target, data));
    }

    private static RemoteViews viewsFor(Context context, Target target, JSONObject data) {
        if (target.type == TYPE_COMPACT) return buildCompact(context, data, target.id, target.location);
        if (target.type == TYPE_DETAILS) return buildDetails(context, data, target.id, target.location);
        if (target.type == TYPE_FORECAST) return buildForecast(context, data, target.id, target.location);
        if (target.type == TYPE_CAPSULE) return buildCapsule(context, data, target.id, target.location);
        return buildGlass(context, data, target.id, target.location);
    }

    private static JSONObject fetchJson(Context context, WidgetPreferences.Location location) {
        for (int attempt = 0; attempt < 2; attempt++) {
            HttpURLConnection connection = null;
            try {
                String endpoint = API_URL
                        + "?lat=" + String.format(Locale.US, "%.6f", location.lat)
                        + "&lon=" + String.format(Locale.US, "%.6f", location.lon)
                        + "&oras=" + URLEncoder.encode(location.city, "UTF-8")
                        + "&admin=" + URLEncoder.encode(location.admin, "UTF-8")
                        + "&country=" + URLEncoder.encode(location.country, "UTF-8");
                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(55000);
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "MeteoNowWidget/3.0");

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("HTTP " + status);
                }

                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }

                JSONObject data = new JSONObject(body.toString());
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                        .putString(cacheStorageKey(location), body.toString()).apply();
                return data;
            } catch (Exception ignored) {
                if (attempt == 0) {
                    try {
                        Thread.sleep(1200);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        WidgetDiagnostics.failed(context);
        return cachedData(context, location);
    }

    private static JSONObject cachedData(Context context, WidgetPreferences.Location location) {
        try {
            String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getString(cacheStorageKey(location), null);
            if (json == null && "Târgoviște".equalsIgnoreCase(location.city)) {
                json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .getString(LEGACY_CACHE_KEY, null);
            }
            return json == null ? null : new JSONObject(json);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String requestKey(WidgetPreferences.Location location) {
        return location.cacheKey() + "|" + location.city + "|" + location.admin + "|" + location.country;
    }

    private static String cacheStorageKey(WidgetPreferences.Location location) {
        return CACHE_PREFIX + location.cacheKey() + "_"
                + Integer.toHexString(requestKey(location).hashCode());
    }

    private static final class Target {
        final int id;
        final int type;
        final WidgetPreferences.Location location;

        Target(int id, int type, WidgetPreferences.Location location) {
            this.id = id;
            this.type = type;
            this.location = location;
        }
    }
    private static RemoteViews buildCapsule(Context context, JSONObject data, int id,
                                             WidgetPreferences.Location location) {
        RemoteViews regular = capsuleLayout(context, data, id, location, R.layout.widget_capsule);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Map<SizeF, RemoteViews> sizes = new LinkedHashMap<>();
            sizes.put(new SizeF(110, 40), capsuleLayout(context, data, id, location,
                    R.layout.widget_capsule_short));
            sizes.put(new SizeF(130, 72), regular);
            return new RemoteViews(sizes);
        }
        // Older launchers do not support size maps; keep the one-row layout safe.
        return capsuleLayout(context, data, id, location, R.layout.widget_capsule_short);
    }

    private static RemoteViews capsuleLayout(Context context, JSONObject data, int id,
                                              WidgetPreferences.Location location, int layout) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        bindActions(context, views, R.id.capsule_root, R.id.capsule_oras, id, location);
        String cityName = data == null ? location.city : data.optString("oras", location.city);
        String temperature = data == null ? "--°" : data.optString("tempText", "--°");
        String description = data == null ? "Fără conexiune" : data.optString("descriere", "Vremea acum");
        String range = data == null ? "Fără conexiune" : maxMin(data);
        views.setTextViewText(R.id.capsule_oras, cityName);
        views.setTextViewText(R.id.capsule_temp, temperature);
        views.setTextViewText(R.id.capsule_maxmin, range);
        views.setImageViewResource(R.id.capsule_icon, data == null ? R.drawable.ic_w_nor : iconForCurrent(data));
        views.setInt(R.id.capsule_root, "setBackgroundResource", capsuleBackground(data));
        String warning = data != null && data.optInt("codAvertizare", 0) > 0
                ? ". " + data.optString("codText", "Avertizare meteo") : "";
        views.setContentDescription(R.id.capsule_root,
                cityName + ". " + temperature + ". " + description + ". " + range + warning);
        return views;
    }

    private static int capsuleBackground(JSONObject data) {
        int background = backgroundFor(data);
        if (background == R.drawable.widget_weather_night) return R.drawable.widget_capsule_night;
        if (background == R.drawable.widget_weather_sunset) return R.drawable.widget_capsule_sunset;
        if (background == R.drawable.widget_weather_cloudy) return R.drawable.widget_capsule_cloudy;
        if (background == R.drawable.widget_weather_rain) return R.drawable.widget_capsule_rain;
        if (background == R.drawable.widget_weather_storm) return R.drawable.widget_capsule_storm;
        if (background == R.drawable.widget_weather_snow) return R.drawable.widget_capsule_snow;
        if (background == R.drawable.widget_weather_fog) return R.drawable.widget_capsule_fog;
        return R.drawable.widget_capsule_day;
    }

    private static RemoteViews buildCompact(Context context, JSONObject data, int appWidgetId,
                                                    WidgetPreferences.Location location) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_compact);
        bindActions(context, views, R.id.compact_root, R.id.compact_oras, appWidgetId, location);
        views.setInt(R.id.compact_root, "setBackgroundResource", backgroundFor(data));

        if (data == null) {
            views.setTextViewText(R.id.compact_temp, "--°");
            views.setTextViewText(R.id.compact_desc, "Fără conexiune");
            views.setTextViewText(R.id.compact_maxmin, "Actualizare automată în curs");
            views.setTextViewText(R.id.compact_actualizat, "");
            views.setViewVisibility(R.id.compact_warning, View.GONE);
            return views;
        }

        views.setTextViewText(R.id.compact_oras, city(data));
        views.setTextViewText(R.id.compact_temp, data.optString("tempText", "--°"));
        views.setTextViewText(R.id.compact_desc, data.optString("descriere", "Vremea acum"));
        views.setTextViewText(R.id.compact_maxmin, compactSummary(data));
        views.setTextViewText(R.id.compact_actualizat, time(data));
        views.setImageViewResource(R.id.compact_icon, iconForCurrent(data));
        bindWarning(views, R.id.compact_warning, data, true);
        return views;
    }

    private static RemoteViews buildDetails(Context context, JSONObject data, int appWidgetId,
                                                    WidgetPreferences.Location location) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_details);
        bindActions(context, views, R.id.details_root, R.id.details_oras, appWidgetId, location);
        views.setInt(R.id.details_root, "setBackgroundResource", backgroundFor(data));

        if (data == null) {
            views.setTextViewText(R.id.details_temp, "--°");
            views.setTextViewText(R.id.details_desc, "Fără conexiune");
            views.setTextViewText(R.id.details_maxmin, "Actualizare automată în curs");
            views.setTextViewText(R.id.details_feels, "--°");
            views.setTextViewText(R.id.details_humidity, "--%");
            views.setTextViewText(R.id.details_wind, "-- km/h");
            views.setTextViewText(R.id.details_actualizat, "");
            views.setViewVisibility(R.id.details_warning, View.GONE);
            return views;
        }

        views.setTextViewText(R.id.details_oras, city(data));
        views.setTextViewText(R.id.details_temp, data.optString("tempText", "--°"));
        views.setTextViewText(R.id.details_desc, data.optString("descriere", ""));
        views.setTextViewText(R.id.details_maxmin, maxMin(data));
        views.setTextViewText(R.id.details_actualizat, time(data));
        views.setImageViewResource(R.id.details_icon, iconForCurrent(data));

        Integer feels = nullableInt(data, "resimtit");
        Integer humidity = nullableInt(data, "umiditate");
        Integer wind = nullableInt(data, "vant");
        views.setTextViewText(R.id.details_feels, feels == null ? "--°" : feels + "° resimțită");
        views.setTextViewText(R.id.details_humidity, humidity == null ? "--%" : humidity + "% umid.");
        views.setTextViewText(R.id.details_wind, wind == null ? "-- km/h" : wind + " km/h");
        bindWarning(views, R.id.details_warning, data, true);
        return views;
    }

    private static RemoteViews buildForecast(Context context, JSONObject data, int appWidgetId,
                                                     WidgetPreferences.Location location) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_meteo);
        bindActions(context, views, R.id.forecast_root, R.id.forecast_oras, appWidgetId, location);
        views.setInt(R.id.forecast_root, "setBackgroundResource", backgroundFor(data));

        if (data == null) {
            views.setTextViewText(R.id.forecast_temp, "--°");
            views.setTextViewText(R.id.forecast_desc, "Fără conexiune");
            views.setTextViewText(R.id.forecast_maxmin, "Actualizare automată în curs");
            views.setTextViewText(R.id.forecast_actualizat, "");
            views.setViewVisibility(R.id.forecast_warning, View.GONE);
            bindForecastDetails(views, null);
            bindDays(views, null);
            return views;
        }

        views.setTextViewText(R.id.forecast_oras, city(data));
        views.setTextViewText(R.id.forecast_temp, data.optString("tempText", "--°"));
        views.setTextViewText(R.id.forecast_desc, data.optString("descriere", ""));
        views.setTextViewText(R.id.forecast_maxmin, maxMin(data));
        views.setTextViewText(R.id.forecast_actualizat, time(data));
        views.setImageViewResource(R.id.forecast_icon, iconForCurrent(data));
        bindForecastDetails(views, data);
        bindWarning(views, R.id.forecast_warning, data, false);
        bindDays(views, data);
        return views;
    }

    private static RemoteViews buildGlass(Context context, JSONObject data, int appWidgetId,
                                                   WidgetPreferences.Location location) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_glass_medium);
        bindActions(context, views, R.id.glass_root, R.id.glass_oras, appWidgetId, location);

        if (data == null) {
            views.setTextViewText(R.id.glass_oras, location.city.toUpperCase(Locale.ROOT));
            views.setTextViewText(R.id.glass_temp, "--°");
            views.setTextViewText(R.id.glass_desc, "Fără conexiune");
            views.setTextViewText(R.id.glass_maxmin, "Actualizare automată în curs");
            views.setTextViewText(R.id.glass_actualizat, "");
            views.setViewVisibility(R.id.glass_warning, View.GONE);
            bindGlassDays(views, null);
            return views;
        }

        views.setTextViewText(R.id.glass_oras, city(data));
        views.setTextViewText(R.id.glass_temp, data.optString("tempText", "--°"));
        views.setTextViewText(R.id.glass_desc, data.optString("descriere", ""));
        views.setTextViewText(R.id.glass_maxmin, maxMin(data));
        views.setTextViewText(R.id.glass_actualizat, time(data));
        views.setImageViewResource(R.id.glass_icon, iconForCurrent(data));
        bindWarning(views, R.id.glass_warning, data, true);
        bindGlassDays(views, data);
        return views;
    }

    private static void bindGlassDays(RemoteViews views, JSONObject data) {
        int[] nameIds = {
                R.id.glass_day1_name, R.id.glass_day2_name,
                R.id.glass_day3_name, R.id.glass_day4_name
        };
        int[] iconIds = {
                R.id.glass_day1_icon, R.id.glass_day2_icon,
                R.id.glass_day3_icon, R.id.glass_day4_icon
        };
        int[] tempIds = {
                R.id.glass_day1_temp, R.id.glass_day2_temp,
                R.id.glass_day3_temp, R.id.glass_day4_temp
        };
        JSONArray days = data == null ? null : data.optJSONArray("zile");
        for (int i = 0; i < 4; i++) {
            JSONObject day = days == null ? null : days.optJSONObject(i);
            if (day == null) {
                views.setTextViewText(nameIds[i], "--");
                views.setTextViewText(tempIds[i], "--°  --°");
                views.setImageViewResource(iconIds[i], R.drawable.ic_w_nor);
            } else {
                views.setTextViewText(nameIds[i], glassDayLabel(day.optString("zi", "--")));
                views.setTextViewText(tempIds[i],
                        day.optInt("max", 0) + "°  " + day.optInt("min", 0) + "°");
                views.setImageViewResource(iconIds[i], iconFor(day.optString("icon", "nor")));
            }
        }
    }

    private static String glassDayLabel(String shortName) {
        String normalized = shortName == null ? "" : shortName.trim().toLowerCase(Locale.ROOT);
        if ("lu".equals(normalized)) return "lun.";
        if ("ma".equals(normalized)) return "mar.";
        if ("mi".equals(normalized)) return "mie.";
        if ("jo".equals(normalized)) return "joi.";
        if ("vi".equals(normalized)) return "vin.";
        if ("sâ".equals(normalized) || "sa".equals(normalized)) return "sâm.";
        if ("du".equals(normalized)) return "dum.";
        return normalized.isEmpty() ? "--" : normalized;
    }
    private static void bindForecastDetails(RemoteViews views, JSONObject data) {
        Integer feels = data == null ? null : nullableInt(data, "resimtit");
        Integer humidity = data == null ? null : nullableInt(data, "umiditate");
        Integer wind = data == null ? null : nullableInt(data, "vant");
        views.setTextViewText(R.id.forecast_feels, feels == null ? "--°" : feels + "°");
        views.setTextViewText(R.id.forecast_humidity, humidity == null ? "--%" : humidity + "%");
        views.setTextViewText(R.id.forecast_wind, wind == null ? "-- km/h" : wind + " km/h");
    }

    private static void bindDays(RemoteViews views, JSONObject data) {
        int[] nameIds = {R.id.day1_name, R.id.day2_name, R.id.day3_name};
        int[] iconIds = {R.id.day1_icon, R.id.day2_icon, R.id.day3_icon};
        int[] tempIds = {R.id.day1_temp, R.id.day2_temp, R.id.day3_temp};
        JSONArray days = data == null ? null : data.optJSONArray("zile");

        views.setViewVisibility(R.id.forecast_days, View.VISIBLE);
        views.setViewVisibility(R.id.forecast_no_days, View.GONE);
        views.setTextViewText(R.id.forecast_section_title, "PROGNOZA PE 3 ZILE");

        for (int i = 0; i < 3; i++) {
            JSONObject day = days == null ? null : days.optJSONObject(i);
            if (day == null) {
                views.setTextViewText(nameIds[i], "--");
                views.setTextViewText(tempIds[i], "--° / --°");
                views.setImageViewResource(iconIds[i], R.drawable.ic_w_nor);
            } else {
                views.setTextViewText(nameIds[i],
                        day.optString("zi", "--").toUpperCase(Locale.ROOT));
                views.setTextViewText(tempIds[i],
                        day.optInt("max", 0) + "° / " + day.optInt("min", 0) + "°");
                views.setImageViewResource(iconIds[i], iconFor(day.optString("icon", "nor")));
            }
        }
    }

    private static void bindWarning(RemoteViews views, int viewId,
                                    JSONObject data, boolean shortText) {
        int code = data.optInt("codAvertizare", 0);
        if (code <= 0) {
            views.setViewVisibility(viewId, View.GONE);
            return;
        }

        String level = data.optString("codText", "Avertizare").toUpperCase(Locale.ROOT);
        String message = data.optString("avertizare", "");
        views.setTextViewText(viewId,
                shortText || message.isEmpty() ? "!  " + level : "!  " + level + " · " + message);
        views.setInt(viewId, "setBackgroundResource", warningBackground(code));
        views.setTextColor(viewId, code == 1 ? 0xFF27313B : 0xFFFFFFFF);
        views.setViewVisibility(viewId, View.VISIBLE);
    }

    private static int warningBackground(int code) {
        if (code == 1) return R.drawable.widget_warning_yellow;
        if (code == 2) return R.drawable.widget_warning_orange;
        return R.drawable.widget_warning_red;
    }

    private static int backgroundFor(JSONObject data) {
        if (data == null) return R.drawable.widget_weather_night;
        String icon = currentIconName(data);
        // A sky tint must never hide the actual precipitation or fog.
        if ("ploaie".equals(icon) || "burnita".equals(icon)) return R.drawable.widget_weather_rain;
        if ("furtuna".equals(icon)) return R.drawable.widget_weather_storm;
        if ("ninsoare".equals(icon) || "lapovita".equals(icon)) return R.drawable.widget_weather_snow;
        if ("ceata".equals(icon)) return R.drawable.widget_weather_fog;
        String theme = data.optString("fundal", "").toLowerCase(Locale.ROOT);
        if (isNight(data)) return R.drawable.widget_weather_night;
        if ("nor".equals(icon)) return R.drawable.widget_weather_cloudy;
        if ("apus".equals(theme)) return R.drawable.widget_weather_sunset;
        return R.drawable.widget_weather_day;
    }

    private static String city(JSONObject data) {
        return data.optString("oras", "Târgoviște").toUpperCase(Locale.ROOT);
    }

    private static String time(JSONObject data) {
        return data.optString("actualizat", "");
    }

    private static String maxMin(JSONObject data) {
        Integer max = nullableInt(data, "maxAzi");
        Integer min = nullableInt(data, "minAzi");
        if (max != null && min != null) {
            return "Max " + max + "°  ·  Min " + min + "°";
        }
        Integer feels = nullableInt(data, "resimtit");
        return feels == null ? "Date meteo în actualizare" : "Se simte ca " + feels + "°";
    }

    private static String compactSummary(JSONObject data) {
        Integer max = nullableInt(data, "maxAzi");
        Integer min = nullableInt(data, "minAzi");
        if (max != null && min != null) return maxMin(data);

        Integer feels = nullableInt(data, "resimtit");
        Integer humidity = nullableInt(data, "umiditate");
        StringBuilder summary = new StringBuilder();
        if (feels != null) summary.append("Resimțită ").append(feels).append("°");
        if (humidity != null) {
            if (summary.length() > 0) summary.append("  ·  ");
            summary.append(humidity).append("% umid.");
        }
        return summary.length() == 0 ? "Date meteo în actualizare" : summary.toString();
    }

    private static Integer nullableInt(JSONObject data, String key) {
        if (!data.has(key) || data.isNull(key)) return null;
        return data.optInt(key);
    }
    private static void bindActions(Context context, RemoteViews views,
                                    int rootId, int cityId, int appWidgetId,
                                    WidgetPreferences.Location location) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        int requestBase = 1000 + Math.abs(appWidgetId % 500000) * 3;

        Uri openUri = Uri.parse(SITE_URL).buildUpon()
                .appendQueryParameter("widgetOpen", "1")
                .appendQueryParameter("widgetCity", location.city)
                .appendQueryParameter("widgetAdmin", location.admin)
                .appendQueryParameter("widgetCountry", location.country)
                .appendQueryParameter("widgetLat", String.format(Locale.US, "%.6f", location.lat))
                .appendQueryParameter("widgetLon", String.format(Locale.US, "%.6f", location.lon))
                .build();
        Intent openApp = new Intent(context, LauncherActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(openUri)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(rootId,
                PendingIntent.getActivity(context, requestBase, openApp, flags));

        Intent configure = new Intent(context, WidgetConfigActivity.class)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                .setData(Uri.parse("meteonow://widget/config/" + appWidgetId));
        views.setOnClickPendingIntent(cityId,
                PendingIntent.getActivity(context, requestBase + 2, configure, flags));
    }
    private static boolean isNight(JSONObject data) {
        int day = data.optInt("isDay", -1);
        if (day == 0 || day == 1) return day == 0;
        return "noapte".equalsIgnoreCase(data.optString("fundal", ""))
                || "luna".equalsIgnoreCase(data.optString("icon", ""));
    }

    private static String currentIconName(JSONObject data) {
        // Prefer the same WMO code as the app; old cached JSON still has icon.
        int code = data.optInt("weatherCode", -1);
        if (code == 0) return isNight(data) ? "luna" : "soare";
        if (code == 1 || code == 2) return "partial";
        if (code == 3) return "nor";
        if (code == 45 || code == 48) return "ceata";
        if (code == 51 || code == 53 || code == 55 || code == 56 || code == 57) return "burnita";
        if (code == 61 || code == 63 || code == 65 || code == 66 || code == 67
                || code == 80 || code == 81 || code == 82) return "ploaie";
        if (code == 68 || code == 69) return "lapovita";
        if (code == 71 || code == 73 || code == 75 || code == 77 || code == 85 || code == 86) return "ninsoare";
        if (code == 95 || code == 96 || code == 99) return "furtuna";
        return data.optString("icon", "nor").toLowerCase(Locale.ROOT);
    }

    private static int iconForCurrent(JSONObject data) {
        String icon = currentIconName(data);
        if ("ploaie".equals(icon) || "burnita".equals(icon) || "ninsoare".equals(icon)
                || "lapovita".equals(icon) || "furtuna".equals(icon) || "ceata".equals(icon)
                || "nor".equals(icon)) return iconFor(icon);
        String theme = data.optString("fundal", "").toLowerCase(Locale.ROOT);
        if ("apus".equals(theme)) return R.drawable.ic_w_sunset;
        if (isNight(data)) {
            if ("partial".equals(icon)) return R.drawable.ic_w_moon_cloud;
            if ("soare".equals(icon) || "luna".equals(icon)) return R.drawable.ic_w_luna;
        }
        return iconFor(icon);
    }

    private static int iconFor(String name) {
        if ("soare".equals(name)) return R.drawable.ic_w_soare;
        if ("luna".equals(name)) return R.drawable.ic_w_luna;
        if ("partial".equals(name)) return R.drawable.ic_w_partial;
        if ("ploaie".equals(name) || "burnita".equals(name)) return R.drawable.ic_w_ploaie;
        if ("ninsoare".equals(name)) return R.drawable.ic_w_ninsoare;
        if ("lapovita".equals(name)) return R.drawable.ic_w_lapovita;
        if ("furtuna".equals(name)) return R.drawable.ic_w_furtuna;
        if ("ceata".equals(name)) return R.drawable.ic_w_ceata;
        return R.drawable.ic_w_nor;
    }
}
