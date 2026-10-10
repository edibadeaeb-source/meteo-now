# Firebase private-access migration — 2026-10-11

## Deployed state

Project `licenta-ae902` now denies anonymous reads and writes by default in Realtime Database. All anonymous writes are denied, including the unused station sensor paths. The deployed rules exactly match `firebase/database.rules.json`. The earlier `firebase/database.rules.proposed.json` is an unapplied proposal; do not confuse it with the active rules.

Both Render services, `meteo-now` and `meteo-vechi` (`meteo-targoviste.onrender.com`), have a private `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable and `METEO_FIREBASE_REQUIRE_AUTH=1`. Both credential deployments reached live status before database rules were changed. The user explicitly requested that the old service remain functional. Git's `backup` branch is a separate source backup; the old Render service is a running deployment.

Anonymous reads of the root, `push_subs`, `push_android_status`, push state branches, `widget_cities_e2e` and `comenzi` now return 401. Mobile subscriptions, notification state and encrypted widget synchronization remain accessible through the authenticated backend. Native clients without browser Origin remain supported; the owned legacy HTTPS origin is also explicitly allowed by the application.

## Server identity and backup

Dedicated identity: `meteo-now-rtdb@licenta-ae902.iam.gserviceaccount.com`. Its custom project role contains only `firebasedatabase.instances.get` and `firebasedatabase.instances.update`; no Owner, Editor, IAM-management or billing role was granted. These Firebase permissions are coarse: they cover database data and metadata, and `instances.update` also allows rules changes and enabling/disabling existing database instances. This is not path-limited access. Both services currently use the same dedicated key; separating their identities is possible later.

The original database, original rules, original IAM policy and recovery credential were saved outside the repository in `05-Date-si-integrari/Firebase-si-date/Backup-securitate-20261011`. Directory inheritance was disabled and access limited to the current Windows user and SYSTEM. Secrets were neither added to Git nor public static files nor included in verification reports.

Original database backup: 58,819 bytes; SHA-256 `bc3e1df428c6b25f28414fbd39704def64949d0c43ed2ef5866b783f21ea9d01`. Its JSON structure was validated before applying new rules. Original root grants were `.read: true` and `.write: true`.

## Unused station writers closed and remaining work

The following existing station paths retain public reads, but now deny public writes: `senzori/bme680`, `senzori/lorawan`, `istoric/lorawan`, `esp32_location`, `sparkfun_location`, `status`, and `status_lorawan`. Their temporary write exceptions were removed after the user confirmed that the sensors are no longer used. Existing data was not deleted. Unrecognized station paths remain denied. Any future ESP32/MQTT/LoRaWAN writer must use proper authentication before being restarted; the old bridge's Firebase web API key is not a substitute for database writer authentication.

`comenzi` is private by default; old direct anonymous sensor-command clients require authentication. No firmware or physical station authentication was changed in this migration.

The previously exposed OpenWeather credential still requires provider-side rotation. Account 2FA, membership review, provider spending limits and external monitoring were not configured here. Application quotas still have the single-host/redeploy limitations described in `SECURITY-20261010.md`.

## Validation

- All 79 Python tests passed, including 25 security tests and the added owned-legacy-origin check.
- Official Firebase CLI rules validation passed before deployment; deployment through the official Firebase MCP completed successfully. A read-back confirmed the active rules match the tracked file exactly.
- Local Realtime Database emulator tests denied anonymous root/private/command/unknown-path writes and a mixed station/private atomic update. Every station path rejected anonymous PUT, PATCH, DELETE and descendant writes; denied requests left existing fixtures unchanged. Trusted-server writes and existing public station reads passed. Write attack probes ran only against the local emulator.
- After the live rule change, anonymous shallow private reads returned 401, authenticated private reads returned 200, and public station reads returned 200.
- Both live Render services successfully saved and read a newly generated encrypted widget-sync test record. Each test record was removed using authenticated cleanup; existing user records were not modified.
- Status-only evidence is stored in `03-Testare-si-capturi/tests/firebase-private-live-20261011.json`. No subscription identifiers, user coordinates, payloads or keys are included.
- The rules immediately before closing station writes and the final deployment/read-back results are also saved privately in `Backup-securitate-20261011`, under filenames beginning `rules-before-sensor-lockdown` and `rules-sensor-lockdown`.

These checks verify backend access and synchronization. They do not prove notification delivery on a physical phone; no broadcast notification or production overload test was sent. Confirm enabling/disabling notifications and city/widget synchronization on the S24 Ultra after deployment. Server changes do not require a new APK.

References: https://firebase.google.com/docs/database/rest/auth ; https://firebase.google.com/docs/projects/iam/permissions ; https://firebase.google.com/docs/database/security
