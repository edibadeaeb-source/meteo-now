package com.onrender.meteo_targoviste.twa.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextWatcher;
import android.text.style.StyleSpan;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.onrender.meteo_targoviste.twa.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Ecranul nativ folosit la adăugarea și reconfigurarea unui widget. */
public class WidgetConfigActivity extends Activity {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final List<WidgetPreferences.Location> visibleResults = new ArrayList<>();

    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private int searchGeneration;
    private boolean internalTextChange;
    private WidgetPreferences.Location selected;
    private EditText searchInput;
    private Button searchButton;
    private Button savedCitiesButton;
    private Button saveButton;
    private ProgressBar progress;
    private TextView status;
    private LinearLayout results;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        setContentView(R.layout.activity_widget_config);

        appWidgetId = widgetIdFrom(getIntent());
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        searchInput = findViewById(R.id.widget_config_search_input);
        searchButton = findViewById(R.id.widget_config_search_button);
        savedCitiesButton = findViewById(R.id.widget_config_saved_cities);
        saveButton = findViewById(R.id.widget_config_save);
        progress = findViewById(R.id.widget_config_progress);
        status = findViewById(R.id.widget_config_status);
        results = findViewById(R.id.widget_config_results);

        selected = locationFromIntent(getIntent());
        if (selected == null && WidgetPreferences.isConfigured(this, appWidgetId)) {
            selected = WidgetPreferences.load(this, appWidgetId);
        }

        visibleResults.clear();
        visibleResults.addAll(WidgetPreferences.savedLocations(this));
        if (selected != null && !containsLocation(visibleResults, selected)) {
            visibleResults.add(0, selected);
        }
        renderResults();

        if (selected != null) {
            internalTextChange = true;
            searchInput.setText(selected.city);
            searchInput.setSelection(searchInput.length());
            internalTextChange = false;
            showSelected();
            saveButton.setEnabled(true);
        } else {
            searchInput.setText("");
            status.setText(visibleResults.isEmpty()
                    ? R.string.widget_config_no_saved
                    : R.string.widget_config_choose_saved);
            saveButton.setEnabled(false);
        }

        searchInput.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (internalTextChange) return;
                if (selected != null && !s.toString().trim().equalsIgnoreCase(selected.city)) {
                    selected = null;
                    saveButton.setEnabled(false);
                    status.setText(R.string.widget_config_search_help);
                }
            }
            @Override public void afterTextChanged(Editable s) { }
        });

        searchButton.setOnClickListener(v -> search());
        savedCitiesButton.setOnClickListener(v -> showSavedCities());
        searchInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                search();
                return true;
            }
            return false;
        });
        saveButton.setOnClickListener(v -> saveSelection());
        refreshSyncedCities();
    }

    private void refreshSyncedCities() {
        if (selected == null) status.setText(R.string.widget_config_syncing);
        WidgetCitySync.refresh(this, updated -> {
            if (isFinishing() || isDestroyed()) return;
            if (updated) {
                visibleResults.clear();
                visibleResults.addAll(WidgetPreferences.savedLocations(this));
                if (selected != null && !containsLocation(visibleResults, selected)) {
                    visibleResults.add(0, selected);
                }
                renderResults();
            }
            if (selected != null) {
                showSelected();
            } else {
                status.setText(visibleResults.isEmpty()
                        ? R.string.widget_config_no_saved
                        : R.string.widget_config_choose_saved);
            }
        });
    }

    private int widgetIdFrom(Intent intent) {
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID);
        Uri data = intent.getData();
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID && data != null) {
            try {
                id = Integer.parseInt(data.getQueryParameter("widgetId"));
            } catch (Exception ignored) { }
        }
        return id;
    }

    private WidgetPreferences.Location locationFromIntent(Intent intent) {
        Uri data = intent.getData();
        if (data == null || !"meteonow".equals(data.getScheme())
                || !"widget-city".equals(data.getHost())) return null;
        try {
            String city = data.getQueryParameter("city");
            String admin = data.getQueryParameter("admin");
            String country = data.getQueryParameter("country");
            double lat = Double.parseDouble(data.getQueryParameter("lat"));
            double lon = Double.parseDouble(data.getQueryParameter("lon"));
            if (city == null || city.trim().isEmpty()
                    || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
            return new WidgetPreferences.Location(city, admin, country, lat, lon);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void showSavedCities() {
        visibleResults.clear();
        visibleResults.addAll(WidgetPreferences.savedLocations(this));
        if (selected != null && !containsLocation(visibleResults, selected)) {
            visibleResults.add(0, selected);
        }
        renderResults();
        status.setText(visibleResults.isEmpty()
                ? R.string.widget_config_syncing
                : R.string.widget_config_choose_saved);
        refreshSyncedCities();
    }

    private boolean containsLocation(List<WidgetPreferences.Location> locations,
                                     WidgetPreferences.Location wanted) {
        for (WidgetPreferences.Location location : locations) {
            if (Math.abs(location.lat - wanted.lat) < 0.00001
                    && Math.abs(location.lon - wanted.lon) < 0.00001) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        WidgetPreferences.Location location = locationFromIntent(intent);
        if (location == null) return;
        select(location);
        status.setText(getString(R.string.widget_config_from_app, location.displayName()));
    }

    private void search() {
        final String query = searchInput.getText().toString().trim();
        if (query.length() < 2) {
            status.setText(R.string.widget_config_search_help);
            return;
        }

        final int generation = ++searchGeneration;
        progress.setVisibility(View.VISIBLE);
        searchButton.setEnabled(false);
        status.setText(R.string.widget_config_searching);
        results.removeAllViews();

        executor.execute(() -> {
            try {
                List<WidgetPreferences.Location> found = searchCities(query);
                runOnUiThread(() -> {
                    if (generation != searchGeneration || isFinishing()) return;
                    finishSearch();
                    visibleResults.clear();
                    visibleResults.addAll(found);
                    renderResults();
                    if (found.isEmpty()) {
                        status.setText(R.string.widget_config_no_results);
                    } else if (found.size() == 1
                            || found.get(0).city.equalsIgnoreCase(query)) {
                        select(found.get(0));
                    } else {
                        status.setText(R.string.widget_config_choose_result);
                    }
                });
            } catch (Exception ignored) {
                runOnUiThread(() -> {
                    if (generation != searchGeneration || isFinishing()) return;
                    finishSearch();
                    status.setText(R.string.widget_config_network_error);
                });
            }
        });
    }

    private List<WidgetPreferences.Location> searchCities(String query) throws Exception {
        String endpoint = "https://geocoding-api.open-meteo.com/v1/search?name="
                + URLEncoder.encode(query, "UTF-8")
                + "&count=8&language=ro&format=json";
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(12000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "MeteoNowWidget/3.0");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code);

            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }

            JSONArray items = new JSONObject(body.toString()).optJSONArray("results");
            List<WidgetPreferences.Location> found = new ArrayList<>();
            if (items == null) return found;
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null || !item.has("latitude") || !item.has("longitude")) continue;
                String city = item.optString("name", "").trim();
                if (city.isEmpty()) continue;
                String country = item.optString("country_code",
                        item.optString("country", "")).toUpperCase(Locale.ROOT);
                found.add(new WidgetPreferences.Location(
                        city, item.optString("admin1", ""), country,
                        item.optDouble("latitude"), item.optDouble("longitude")));
            }
            return found;
        } finally {
            connection.disconnect();
        }
    }

    private void renderResults() {
        results.removeAllViews();
        for (WidgetPreferences.Location location : visibleResults) {
            TextView row = new TextView(this);
            String title = location.city;
            StringBuilder secondaryText = new StringBuilder();
            if (!location.admin.isEmpty() && !location.admin.equalsIgnoreCase(location.city)) {
                secondaryText.append(location.admin);
            }
            if (!location.country.isEmpty()) {
                if (secondaryText.length() > 0) secondaryText.append(" · ");
                secondaryText.append(location.country);
            }
            String secondary = secondaryText.length() == 0 ? "Localitate" : secondaryText.toString();
            SpannableString text = new SpannableString(title + "\n" + secondary);
            text.setSpan(new StyleSpan(Typeface.BOLD), 0, title.length(),
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            row.setText(text);
            row.setTextColor(0xFFFFFFFF);
            row.setTextSize(15);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setMinHeight(dp(68));
            row.setPadding(dp(15), dp(10), dp(15), dp(10));
            row.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_widget_location, 0, 0, 0);
            row.setCompoundDrawablePadding(dp(10));
            row.setBackgroundResource(isSelected(location)
                    ? R.drawable.widget_config_result_selected
                    : R.drawable.widget_config_result);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            params.topMargin = dp(8);
            row.setLayoutParams(params);
            row.setOnClickListener(v -> select(location));
            results.addView(row);
        }
    }

    private void select(WidgetPreferences.Location location) {
        selected = location;
        internalTextChange = true;
        searchInput.setText(location.city);
        searchInput.setSelection(searchInput.length());
        internalTextChange = false;
        saveButton.setEnabled(true);
        showSelected();
        renderResults();
    }

    private boolean isSelected(WidgetPreferences.Location location) {
        return selected != null
                && Math.abs(selected.lat - location.lat) < 0.00001
                && Math.abs(selected.lon - location.lon) < 0.00001;
    }

    private void showSelected() {
        status.setText(getString(R.string.widget_config_selected, selected.displayName()));
    }

    private void finishSearch() {
        progress.setVisibility(View.GONE);
        searchButton.setEnabled(true);
    }

    private void saveSelection() {
        if (selected == null) return;
        WidgetPreferences.save(this, appWidgetId, selected);
        WeatherWidgetUpdater.configureWidget(this, appWidgetId);

        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        ++searchGeneration;
        executor.shutdownNow();
        super.onDestroy();
    }
}
