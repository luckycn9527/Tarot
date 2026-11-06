package cn.zaopic.etomd;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Only regenerable updater files are counted or removed; no recursion or caller paths. */
final class UpdateCacheStorage {
    static final String[] NAMES = { "update.apk", "update.apk.part", "validated-manifest.json", "validated-manifest.json.tmp" };
    static final class Failure extends Exception {
        final String code;
        Failure(String code) { super(code); this.code = code; }
    }
    static final class Stats {
        final long bytes;
        final int files;
        Stats(long bytes, int files) { this.bytes = bytes; this.files = files; }
    }
    static final class Cleared {
        final Stats remaining;
        final long bytes;
        final int files;
        final boolean complete;
        Cleared(Stats remaining, long bytes, int files, boolean complete) {
            this.remaining = remaining; this.bytes = bytes; this.files = files; this.complete = complete;
        }
    }

    static List<File> targets(File cacheBase) throws Failure {
        try {
            File base = cacheBase.getCanonicalFile();
            File root = new File(base, "updates");
            if (!root.getCanonicalFile().equals(root.getAbsoluteFile()) || (root.exists() && !root.isDirectory())) throw new Failure("CACHE_UNSAFE_PATH");
            List<File> files = new ArrayList<>();
            for (String name : NAMES) {
                File file = new File(root, name);
                if (!file.getCanonicalFile().equals(file.getAbsoluteFile()) || (file.exists() && !file.isFile())) throw new Failure("CACHE_UNSAFE_PATH");
                if (file.isFile()) files.add(file);
            }
            return files;
        } catch (IOException | SecurityException e) { throw new Failure("CACHE_IO_ERROR"); }
    }
    static Stats inspect(File cacheBase) throws Failure {
        long bytes = 0;
        List<File> files = targets(cacheBase);
        for (File file : files) {
            long size = file.length();
            // Keep the bridge's byte count exactly representable as a JS number.
            if (size < 0 || bytes > 9_007_199_254_740_991L - size) throw new Failure("CACHE_IO_ERROR");
            bytes += size;
        }
        return new Stats(bytes, files.size());
    }
    static Cleared clear(File cacheBase) throws Failure {
        List<File> files = targets(cacheBase); // Validate every candidate before deleting any.
        long bytes = 0;
        int removed = 0;
        boolean complete = true;
        for (File file : files) {
            try {
                if (!file.getCanonicalFile().equals(file.getAbsoluteFile()) || (file.exists() && !file.isFile())) throw new Failure("CACHE_UNSAFE_PATH");
                long size = file.length();
                if (file.delete()) { bytes += size; removed++; }
                else if (file.exists()) complete = false;
            } catch (IOException | SecurityException e) { complete = false; }
        }
        return new Cleared(inspect(cacheBase), bytes, removed, complete);
    }
}
