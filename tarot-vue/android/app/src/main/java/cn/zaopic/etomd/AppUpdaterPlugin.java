package cn.zaopic.etomd;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.URL;
import javax.net.ssl.SSLException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A fixed-origin updater. JavaScript never supplies a URL, file path or Intent. */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String ORIGIN = "https://121.40.27.226:9443";
    private static final String FEED = ORIGIN + "/downloads/android-latest.json";
    private static final String APP_ID = "cn.zaopic.etomd";
    private static final long MAX_BYTES = 200L * 1024 * 1024;
    private final Object lock = new Object();
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile HttpURLConnection connection;
    private long generation;
    private String status = "idle", errorCode, message, currentVersion = "";
    private long currentVersionCode, downloadedBytes, totalBytes;
    private boolean downloadReady, cacheClearing;
    private JSONObject latest;
    private File directory, partFile, apkFile, manifestFile;

    @Override public void load() {
        directory = new File(getContext().getCacheDir(), "updates");
        partFile = new File(directory, "update.apk.part");
        apkFile = new File(directory, "update.apk");
        manifestFile = new File(directory, "validated-manifest.json");
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            currentVersion = info.versionName;
            currentVersionCode = versionCode(info);
        } catch (Exception ignored) { }
        final long token;
        synchronized (lock) {
            token = generation;
            // Reserve recovery before JavaScript can start its quiet network check.
            if (apkFile.isFile() && manifestFile.isFile()) status = "verifying";
        }
        worker.execute(() -> restore(token));
    }

    @PluginMethod public void getState(PluginCall call) { call.resolve(snapshot()); }

    @PluginMethod public void getStorageInfo(PluginCall call) {
        synchronized (lock) {
            try {
                rejectCacheLinks();
                call.resolve(storageSnapshot(UpdateCacheStorage.inspect(getContext().getCacheDir())));
            } catch (Exception error) { call.reject("Update cache could not be read", storageCode(error)); }
        }
    }

    @PluginMethod public void clearUpdateCache(PluginCall call) {
        final long token;
        synchronized (lock) {
            if (busy()) { call.reject("Wait for the current update operation", "UPDATER_BUSY"); return; }
            token = ++generation;
            cacheClearing = true;
            emit();
        }
        // A cancelled download can still be closing its streams. Queue cleanup
        // after that work, while the reservation prevents new transfers/installers.
        try { worker.execute(() -> {
            synchronized (lock) {
                if (token != generation) { cacheClearing = false; call.reject("Update operation changed", "UPDATER_BUSY"); return; }
                try {
                    rejectCacheLinks();
                    UpdateCacheStorage.Cleared cleared = UpdateCacheStorage.clear(getContext().getCacheDir());
                    cacheClearing = false;
                    discardCachedDownloadState();
                    JSObject result = new JSObject();
                    result.put("storage", storageSnapshot(cleared.remaining));
                    result.put("clearedBytes", cleared.bytes);
                    result.put("removedFiles", cleared.files);
                    result.put("updateState", snapshot());
                    if (!cleared.complete) result.put("errorCode", "CACHE_IO_ERROR");
                    call.resolve(result);
                } catch (Exception error) {
                    cacheClearing = false;
                    // A failed preflight removed nothing; retain the update state.
                    // If a file was removed before a later I/O error, never claim
                    // its cached APK is still ready to install.
                    if (!apkFile.isFile()) discardCachedDownloadState();
                    else emit();
                    call.reject("Update cache could not be cleared", storageCode(error));
                }
            }
        }); } catch (Exception error) {
            synchronized (lock) { cacheClearing = false; emit(); }
            call.reject("Update cache could not be cleared", "CACHE_IO_ERROR");
        }
    }

    private void discardCachedDownloadState() {
        downloadReady = false;
        downloadedBytes = 0;
        totalBytes = latest == null ? 0 : latest.optLong("bytes");
        String next = latest == null ? "idle" : latest.optLong("versionCode") <= currentVersionCode ? "upToDate"
            : latest.optInt("minSdk") <= Build.VERSION.SDK_INT ? "available" : "error";
        change(next, "error".equals(next) ? "INCOMPATIBLE_SDK" : null, null);
    }

    private JSObject storageSnapshot(UpdateCacheStorage.Stats stats) {
        JSObject result = new JSObject();
        result.put("scope", "update-cache");
        result.put("bytes", stats.bytes);
        result.put("files", stats.files);
        result.put("busy", busy());
        result.put("canClear", !busy() && stats.files > 0);
        return result;
    }
    private static String storageCode(Exception error) {
        return error instanceof UpdateCacheStorage.Failure ? ((UpdateCacheStorage.Failure) error).code : "CACHE_IO_ERROR";
    }
    private void rejectCacheLinks() throws Exception {
        File root = new File(getContext().getCacheDir().getCanonicalFile(), "updates");
        rejectLink(root);
        for (String name : UpdateCacheStorage.NAMES) rejectLink(new File(root, name));
    }
    private static void rejectLink(File file) throws Exception {
        try {
            if (OsConstants.S_ISLNK(Os.lstat(file.getAbsolutePath()).st_mode)) throw new UpdateCacheStorage.Failure("CACHE_UNSAFE_PATH");
        } catch (ErrnoException error) {
            if (error.errno != OsConstants.ENOENT) throw new UpdateCacheStorage.Failure("CACHE_IO_ERROR");
        }
    }

    @PluginMethod public void checkForUpdate(PluginCall call) {
        final long token;
        synchronized (lock) {
            if (busy()) { call.resolve(snapshot()); return; }
            token = ++generation;
            latest = null;
            downloadReady = false;
            downloadedBytes = totalBytes = 0;
            change("checking", null, null);
        }
        call.resolve(snapshot());
        worker.execute(() -> {
            try {
                HttpURLConnection c = open(FEED, token);
                try {
                    int code = c.getResponseCode();
                    if (code == 404) { transition(token, "unavailable"); return; }
                    require(code == 200, "HTTP_ERROR", "Update service returned HTTP " + code);
                    JSONObject manifest = validateManifest(new JSONObject(readText(c.getInputStream(), 128 * 1024)));
                    boolean cached = false;
                    if (manifest.getLong("versionCode") > currentVersionCode && manifest.getInt("minSdk") <= Build.VERSION.SDK_INT
                        && apkFile.isFile() && manifestFile.isFile()) {
                        JSONObject saved = null;
                        try { saved = validateManifest(new JSONObject(readText(new FileInputStream(manifestFile), 128 * 1024))); }
                        catch (Exception ignored) { }
                        if (saved != null && saved.getString("sha256").equals(manifest.getString("sha256"))
                            && saved.getLong("versionCode") == manifest.getLong("versionCode")
                            && saved.getString("version").equals(manifest.getString("version"))
                            && saved.getLong("bytes") == manifest.getLong("bytes") && saved.getInt("minSdk") == manifest.getInt("minSdk")) {
                            transition(token, "verifying");
                            try {
                                verifyApk(apkFile, manifest, token);
                                cached = true;
                            } catch (Exception invalidCache) {
                                synchronized (lock) {
                                    // A cancelled operation must never remove a newer transfer.
                                    checkToken(token);
                                    apkFile.delete();
                                    manifestFile.delete();
                                }
                            }
                        }
                    }
                    synchronized (lock) {
                        if (token != generation) return;
                        latest = manifest;
                        totalBytes = manifest.getLong("bytes");
                        if (manifest.getLong("versionCode") <= currentVersionCode) change("upToDate", null, null);
                        else if (manifest.getInt("minSdk") > Build.VERSION.SDK_INT) throw new UpdateFailure("INCOMPATIBLE_SDK", "This update needs a newer Android version");
                        else {
                            downloadReady = cached;
                            downloadedBytes = cached ? totalBytes : 0;
                            change(cached ? "downloaded" : "available", null, null);
                        }
                    }
                } finally { close(c); }
            } catch (Exception e) { fail(token, e); }
        });
    }

    @PluginMethod public void downloadUpdate(PluginCall call) {
        final long token;
        final JSONObject manifest;
        synchronized (lock) {
            if (busy()) { call.resolve(snapshot()); return; }
            if (latest == null) { change("error", "NO_UPDATE", "Check for an update first"); call.resolve(snapshot()); return; }
            try {
                manifest = validateManifest(latest);
                require(manifest.getLong("versionCode") > currentVersionCode, "NO_UPDATE", "The installed app is up to date");
                require(manifest.getInt("minSdk") <= Build.VERSION.SDK_INT, "INCOMPATIBLE_SDK", "This update needs a newer Android version");
            } catch (Exception e) { change("error", code(e), detail(e)); call.resolve(snapshot()); return; }
            token = ++generation;
            downloadReady = false;
            downloadedBytes = 0;
            totalBytes = manifest.optLong("bytes");
            change("downloading", null, null);
        }
        call.resolve(snapshot());
        worker.execute(() -> download(token, manifest));
    }

    @PluginMethod public void cancelDownload(PluginCall call) {
        synchronized (lock) {
            if ("checking".equals(status) || "downloading".equals(status) || "verifying".equals(status)) {
                ++generation;
                HttpURLConnection c = connection;
                connection = null;
                if (c != null) c.disconnect();
                partFile.delete();
                change("cancelled", null, null);
            }
        }
        call.resolve(snapshot());
    }

    @PluginMethod public void installUpdate(PluginCall call) {
        final long token;
        final JSONObject manifest;
        synchronized (lock) {
            if (busy()) { call.resolve(snapshot()); return; }
            if (latest == null || !apkFile.isFile()) {
                downloadReady = false;
                change("error", "NO_DOWNLOAD", "Download the update first"); call.resolve(snapshot()); return;
            }
            if (!installPermission()) {
                change("permissionRequired", null, "Allow installation from this app, then try again"); call.resolve(snapshot()); return;
            }
            manifest = latest;
            token = ++generation;
            change("verifying", null, null);
        }
        call.resolve(snapshot());
        worker.execute(() -> {
            try {
                verifyApk(apkFile, validateManifest(manifest), token);
                getActivity().runOnUiThread(() -> {
                    synchronized (lock) {
                        if (token != generation) return;
                        downloadReady = true;
                        if (!installPermission()) { change("permissionRequired", null, "Allow installation from this app, then try again"); return; }
                        try {
                            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updater.fileprovider", apkFile);
                            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            installerAway = false;
                            change("installing", null, null);
                            getActivity().startActivity(intent);
                        } catch (Exception e) { change("error", "INSTALL_FAILED", "Android could not open the installer"); }
                    }
                });
            } catch (Exception e) { fail(token, e); }
        });
    }

    @PluginMethod public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26 && !installPermission()) {
            getActivity().runOnUiThread(() -> {
                synchronized (lock) {
                    if (busy()) { call.resolve(snapshot()); return; }
                    try {
                        getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getContext().getPackageName())));
                        change("permissionRequired", null, "Return here after allowing installation");
                    } catch (Exception e) { change("error", "SETTINGS_FAILED", "Android could not open installation settings"); }
                    call.resolve(snapshot());
                }
            });
        } else call.resolve(snapshot());
    }

    private boolean installerAway;
    @Override protected void handleOnPause() { synchronized (lock) { if ("installing".equals(status)) installerAway = true; } }
    @Override protected void handleOnResume() {
        synchronized (lock) {
            if (("installing".equals(status) && installerAway) || "permissionRequired".equals(status)) {
                installerAway = false;
                change(downloadReady && latest != null && apkFile.isFile() ? "downloaded" : "idle", null, null);
            } else emit();
        }
    }
    @Override protected void handleOnDestroy() {
        synchronized (lock) {
            ++generation;
            if (connection != null) connection.disconnect();
            connection = null;
        }
        worker.shutdownNow();
    }

    private boolean busy() {
        return cacheClearing || "checking".equals(status) || "downloading".equals(status) || "verifying".equals(status) || "installing".equals(status);
    }
    private boolean installPermission() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }
    private JSObject snapshot() {
        synchronized (lock) {
            JSObject result = new JSObject();
            result.put("status", status);
            result.put("currentVersion", currentVersion);
            result.put("currentVersionCode", currentVersionCode);
            result.put("applicationId", getContext().getPackageName());
            result.put("site", "domestic");
            result.put("sdkInt", Build.VERSION.SDK_INT);
            result.put("downloadedBytes", downloadedBytes);
            result.put("totalBytes", totalBytes);
            result.put("progress", totalBytes > 0 ? Math.min(100, Math.max(0, downloadedBytes * 100 / totalBytes)) : 0);
            result.put("installPermissionGranted", installPermission());
            result.put("downloadReady", downloadReady && latest != null && apkFile.isFile());
            result.put("cacheClearing", cacheClearing);
            if (latest != null) result.put("latest", latest);
            if (errorCode != null) result.put("errorCode", errorCode);
            if (message != null) result.put("message", message);
            return result;
        }
    }
    private void emit() { notifyListeners("updateState", snapshot()); }
    private void change(String next, String error, String description) {
        status = next; errorCode = error; message = description; emit();
    }
    private void transition(long token, String next) {
        synchronized (lock) { if (token == generation) change(next, null, null); }
    }
    private void fail(long token, Exception e) {
        synchronized (lock) { if (token == generation) { downloadReady = false; change("error", code(e), detail(e)); } }
    }
    private static String code(Exception e) {
        if (e instanceof UpdateFailure) return ((UpdateFailure) e).code;
        if (e instanceof SSLException) return "SECURE_CONNECTION_ERROR";
        if (e instanceof SocketTimeoutException || e instanceof UnknownHostException || e instanceof ConnectException || e instanceof NoRouteToHostException) return "NETWORK_ERROR";
        return "UPDATE_FAILED";
    }
    private static String detail(Exception e) { return e instanceof UpdateFailure ? e.getMessage() : "The update could not be completed. Please try again."; }
    private static void require(boolean value, String code, String message) throws UpdateFailure {
        if (!value) throw new UpdateFailure(code, message);
    }
    private static class UpdateFailure extends Exception {
        final String code;
        UpdateFailure(String code, String message) { super(message); this.code = code; }
    }

    private void checkToken(long token) throws UpdateFailure {
        synchronized (lock) { require(token == generation && !Thread.currentThread().isInterrupted(), "CANCELLED", "Update cancelled"); }
    }
    private HttpURLConnection open(String address, long token) throws Exception {
        // Validate the production address before the compile-time-only QA transport mapping.
        require(FEED.equals(address) || address.matches("https://121\\.40\\.27\\.226:9443/downloads/E-Tomd-(?:0|[1-9][0-9]{0,3})\\.(?:0|[1-9][0-9]{0,3})\\.(?:0|[1-9][0-9]{0,3})-domestic-debug\\.apk"),
            "INVALID_DOWNLOAD_URL", "Untrusted update address");
        URL production = new URL(address);
        URL transport = BuildConfig.UPDATER_QA ? new URL("http://127.0.0.1:19784" + production.getPath()) : production;
        HttpURLConnection c = (HttpURLConnection) transport.openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setInstanceFollowRedirects(false);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        c.setRequestProperty("Accept-Encoding", "identity");
        c.setRequestProperty("Accept", address.equals(FEED) ? "application/json" : "application/vnd.android.package-archive");
        synchronized (lock) {
            if (token != generation) { c.disconnect(); throw new UpdateFailure("CANCELLED", "Update cancelled"); }
            connection = c;
        }
        return c;
    }
    private void close(HttpURLConnection c) {
        c.disconnect();
        synchronized (lock) { if (connection == c) connection = null; }
    }
    private static String readText(InputStream source, int maxBytes) throws Exception {
        try (InputStream input = source; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                require(output.size() + count <= maxBytes, "INVALID_MANIFEST", "Update manifest is too large");
                output.write(buffer, 0, count);
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }
    private static FileOutputStream updateOutput(File target) throws UpdateFailure {
        try { return new FileOutputStream(target); }
        catch (IOException | SecurityException e) { throw new UpdateFailure("STORAGE_ERROR", "Update storage could not be opened"); }
    }
    private static void writeUpdate(FileOutputStream output, byte[] bytes, int count) throws UpdateFailure {
        try { output.write(bytes, 0, count); }
        catch (IOException e) { throw new UpdateFailure("STORAGE_ERROR", "The update could not be stored"); }
    }
    private static void syncUpdate(FileOutputStream output) throws UpdateFailure {
        try { output.getFD().sync(); }
        catch (IOException e) { throw new UpdateFailure("STORAGE_ERROR", "The update could not be saved"); }
    }
    private static int readDownload(InputStream input, byte[] bytes) throws UpdateFailure {
        try { return input.read(bytes); }
        catch (IOException e) { throw new UpdateFailure(e instanceof SSLException ? "SECURE_CONNECTION_ERROR" : "NETWORK_ERROR", "The update connection was interrupted"); }
    }
    private void download(long token, JSONObject manifest) {
        try {
            checkToken(token);
            require(directory.isDirectory() || directory.mkdirs(), "STORAGE_ERROR", "Update storage is unavailable");
            partFile.delete();
            // A new transfer invalidates the previous persisted pair.
            apkFile.delete();
            manifestFile.delete();
            long expected = manifest.getLong("bytes");
            require(directory.getUsableSpace() >= expected + 1024 * 1024, "INSUFFICIENT_STORAGE", "Free device storage before downloading the update");
            HttpURLConnection c = open(manifest.getString("downloadUrl"), token);
            try {
                require(c.getResponseCode() == 200, "HTTP_ERROR", "The update download was not available");
                long contentLength = c.getContentLengthLong();
                require(contentLength < 0 || contentLength == expected, "SIZE_MISMATCH", "Update file size does not match the manifest");
                try (InputStream input = c.getInputStream(); FileOutputStream output = updateOutput(partFile)) {
                    byte[] buffer = new byte[32768];
                    long received = 0, lastEmit = 0;
                    int count;
                    while ((count = readDownload(input, buffer)) != -1) {
                        checkToken(token);
                        received += count;
                        require(received <= expected && received <= MAX_BYTES, "SIZE_MISMATCH", "Update file is larger than expected");
                        writeUpdate(output, buffer, count);
                        synchronized (lock) {
                            if (token == generation) {
                                downloadedBytes = received;
                                long now = android.os.SystemClock.elapsedRealtime();
                                if (now - lastEmit >= 150) { emit(); lastEmit = now; }
                            }
                        }
                    }
                    syncUpdate(output);
                    require(received == expected, "SIZE_MISMATCH", "Update download was incomplete");
                }
            } finally { close(c); }
            checkToken(token);
            transition(token, "verifying");
            verifyApk(partFile, manifest, token);
            synchronized (lock) {
                checkToken(token);
                require(partFile.renameTo(apkFile), "STORAGE_ERROR", "The verified update could not be saved");
                persist(manifest);
                downloadReady = true;
                downloadedBytes = totalBytes = expected;
                change("downloaded", null, null);
            }
        } catch (Exception e) {
            partFile.delete();
            fail(token, e);
        }
    }
    private void persist(JSONObject manifest) throws Exception {
        File temporary = new File(directory, "validated-manifest.json.tmp");
        try (FileOutputStream output = updateOutput(temporary)) {
            byte[] bytes = manifest.toString().getBytes(StandardCharsets.UTF_8);
            writeUpdate(output, bytes, bytes.length);
            syncUpdate(output);
        }
        require(temporary.renameTo(manifestFile), "STORAGE_ERROR", "The verified update record could not be saved");
    }
    private void restore(long token) {
        partFile.delete();
        new File(directory, "validated-manifest.json.tmp").delete();
        if (!apkFile.isFile() || !manifestFile.isFile()) { transition(token, "idle"); return; }
        try {
            JSONObject manifest = validateManifest(new JSONObject(readText(new FileInputStream(manifestFile), 128 * 1024)));
            checkToken(token);
            transition(token, "verifying");
            verifyApk(apkFile, manifest, token);
            synchronized (lock) {
                checkToken(token);
                latest = manifest;
                downloadReady = true;
                downloadedBytes = totalBytes = manifest.getLong("bytes");
                change("downloaded", null, null);
            }
        } catch (Exception e) {
            synchronized (lock) {
                if (token != generation) return;
                downloadReady = false;
                apkFile.delete(); manifestFile.delete();
                if (e instanceof UpdateFailure && "VERSION_MISMATCH".equals(code(e))) change("idle", null, null);
                else change("error", code(e), detail(e));
            }
        }
    }
    @SuppressWarnings("deprecation")
    private void verifyApk(File file, JSONObject manifest, long token) throws Exception {
        checkToken(token);
        require(file.isFile() && file.length() == manifest.getLong("bytes"), "SIZE_MISMATCH", "Update file size does not match the manifest");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768];
            int count;
            while ((count = input.read(buffer)) != -1) { checkToken(token); digest.update(buffer, 0, count); }
        }
        require(hex(digest.digest()).equals(manifest.getString("sha256")), "HASH_MISMATCH", "The update file failed its integrity check");
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        require(archive != null, "INVALID_APK", "Android could not read the update package");
        require(APP_ID.equals(archive.packageName) && APP_ID.equals(getContext().getPackageName()), "WRONG_APPLICATION", "This package belongs to a different application");
        long archiveCode = versionCode(archive);
        require(archiveCode > currentVersionCode && archiveCode == manifest.getLong("versionCode") && manifest.getString("version").equals(archive.versionName),
            "VERSION_MISMATCH", "Update package version does not match the manifest");
        require(archive.applicationInfo != null && archive.applicationInfo.minSdkVersion == manifest.getInt("minSdk")
            && archive.applicationInfo.minSdkVersion <= Build.VERSION.SDK_INT, "INCOMPATIBLE_SDK", "Update package Android requirement does not match the manifest");
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
        Set<String> expectedSigners = signers(installed), actualSigners = signers(archive);
        require(!expectedSigners.isEmpty() && expectedSigners.equals(actualSigners), "SIGNATURE_MISMATCH", "Update package signing certificate does not match this app");
        checkToken(token);
    }
    @SuppressWarnings("deprecation")
    private static Set<String> signers(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28
            ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        Set<String> result = new HashSet<>();
        if (signatures != null) for (Signature signature : signatures) result.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return result;
    }
    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private static String hex(byte[] data) {
        StringBuilder result = new StringBuilder(data.length * 2);
        for (byte value : data) { int b = value & 255; result.append("0123456789abcdef".charAt(b >>> 4)); result.append("0123456789abcdef".charAt(b & 15)); }
        return result.toString();
    }

    private static boolean integer(Object value, long min, long max) {
        if (!(value instanceof Number)) return false;
        double number = ((Number) value).doubleValue();
        return !Double.isNaN(number) && !Double.isInfinite(number) && number == Math.floor(number) && number >= min && number <= max;
    }
    private static String text(JSONObject value, String key) {
        Object item = value.opt(key);
        return item instanceof String ? (String) item : "";
    }
    private static boolean notes(Object value) {
        if (!(value instanceof JSONArray)) return false;
        JSONArray array = (JSONArray) value;
        if (array.length() < 1 || array.length() > 30) return false;
        for (int i = 0; i < array.length(); i++) {
            Object item = array.opt(i);
            if (!(item instanceof String)) return false;
            String note = (String) item;
            // Match the shared model: tabs, CR and LF are permitted within release notes.
            if (note.length() > 500 || note.matches("[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*")) return false;
            for (int j = 0; j < note.length(); j++) {
                char c = note.charAt(j);
                if (c < 32 && c != '\t' && c != '\r' && c != '\n') return false;
            }
        }
        return true;
    }
    private static boolean published(String value) {
        Matcher match = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d{1,3})?(Z|[+-](\\d{2}):(\\d{2}))$").matcher(value);
        if (!match.matches()) return false;
        int year = Integer.parseInt(match.group(1)), month = Integer.parseInt(match.group(2)), day = Integer.parseInt(match.group(3));
        int[] days = { 31, year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
        return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
            && Integer.parseInt(match.group(4)) <= 23 && Integer.parseInt(match.group(5)) <= 59 && Integer.parseInt(match.group(6)) <= 59
            && ("Z".equals(match.group(7)) || (Integer.parseInt(match.group(8)) <= 23 && Integer.parseInt(match.group(9)) <= 59));
    }
    private static JSONObject validateManifest(JSONObject input) throws Exception {
        require(integer(input.opt("schema"), 1, 1), "INVALID_MANIFEST", "Unsupported update manifest");
        require("domestic".equals(input.opt("site")), "WRONG_SITE", "This update is for another distribution");
        require(APP_ID.equals(input.opt("applicationId")), "WRONG_APPLICATION", "This update is for another application");
        String version = text(input, "version");
        require(version.matches("(?:0|[1-9][0-9]{0,3})\\.(?:0|[1-9][0-9]{0,3})\\.(?:0|[1-9][0-9]{0,3})")
            && integer(input.opt("versionCode"), 1, 2100000000L), "INVALID_VERSION", "Invalid update version");
        require(integer(input.opt("minSdk"), 24, 100), "INVALID_MIN_SDK", "Invalid Android requirement");
        require(integer(input.opt("bytes"), 1024 * 1024, MAX_BYTES), "INVALID_SIZE", "Invalid update size");
        require(text(input, "sha256").matches("[0-9a-f]{64}"), "INVALID_HASH", "Invalid update hash");
        String expectedUrl = ORIGIN + "/downloads/E-Tomd-" + version + "-domestic-debug.apk";
        require(expectedUrl.equals(input.opt("downloadUrl")), "INVALID_DOWNLOAD_URL", "Untrusted update address");
        require(notes(input.opt("releaseNotes")) && (!input.has("releaseNotesEn") || notes(input.opt("releaseNotesEn"))),
            "INVALID_RELEASE_NOTES", "Invalid release notes");
        require(published(text(input, "publishedAt")), "INVALID_PUBLISHED_AT", "Invalid release date");
        JSONObject result = new JSONObject();
        result.put("schema", 1).put("site", "domestic").put("applicationId", APP_ID).put("version", version)
            .put("versionCode", input.getLong("versionCode")).put("minSdk", input.getInt("minSdk")).put("bytes", input.getLong("bytes"))
            .put("sha256", input.getString("sha256")).put("downloadUrl", expectedUrl)
            .put("releaseNotes", new JSONArray(input.getJSONArray("releaseNotes").toString())).put("publishedAt", input.getString("publishedAt"));
        if (input.has("releaseNotesEn")) result.put("releaseNotesEn", new JSONArray(input.getJSONArray("releaseNotesEn").toString()));
        return result;
    }
}
