package cn.zaopic.etomd;

import static org.junit.Assert.*;
import java.io.File;
import java.nio.file.Files;
import org.junit.Assume;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class UpdateCacheStorageTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();
    private File file(File root, String name, int bytes) throws Exception {
        File file = new File(root, name);
        Files.write(file.toPath(), new byte[bytes]);
        return file;
    }

    @Test public void onlyKnownUpdateFilesAreCountedAndCleared() throws Exception {
        File base = temporary.newFolder("cache"), root = new File(base, "updates");
        assertTrue(root.mkdir());
        File account = file(base, "private-account.keep", 33), unknown = file(root, "unknown.keep", 29);
        for (int index = 0; index < UpdateCacheStorage.NAMES.length; index++) file(root, UpdateCacheStorage.NAMES[index], index + 1);
        UpdateCacheStorage.Stats stats = UpdateCacheStorage.inspect(base);
        assertEquals(10, stats.bytes); assertEquals(4, stats.files);
        UpdateCacheStorage.Cleared cleared = UpdateCacheStorage.clear(base);
        assertTrue(cleared.complete); assertEquals(10, cleared.bytes); assertEquals(4, cleared.files);
        assertEquals(0, cleared.remaining.bytes); assertEquals(0, cleared.remaining.files);
        assertEquals(33, account.length()); assertEquals(29, unknown.length());
    }

    @Test public void anUnexpectedTargetDirectoryAbortsBeforeDeletingAnyFile() throws Exception {
        File base = temporary.newFolder("preflight"), root = new File(base, "updates");
        assertTrue(root.mkdir());
        File apk = file(root, "update.apk", 16);
        assertTrue(new File(root, "update.apk.part").mkdir());
        try { UpdateCacheStorage.clear(base); fail("Unsafe target should fail"); }
        catch (UpdateCacheStorage.Failure error) { assertEquals("CACHE_UNSAFE_PATH", error.code); }
        assertTrue(apk.isFile()); assertEquals(16, apk.length());
    }

    @Test public void absentCacheIsAnExactZeroAndIsNotCreatedByCleanup() throws Exception {
        File base = temporary.newFolder("empty");
        assertEquals(0, UpdateCacheStorage.inspect(base).bytes);
        UpdateCacheStorage.Cleared cleared = UpdateCacheStorage.clear(base);
        assertEquals(0, cleared.bytes); assertEquals(0, cleared.files); assertEquals(0, cleared.remaining.files);
        assertFalse(new File(base, "updates").exists());
    }

    @Test public void linkedUpdateFilesCannotDeleteOutsideTheCache() throws Exception {
        File base = temporary.newFolder("links"), root = new File(base, "updates");
        assertTrue(root.mkdir());
        File protectedFile = temporary.newFile("protected.keep");
        Files.write(protectedFile.toPath(), new byte[41]);
        try { Files.createSymbolicLink(new File(root, "update.apk").toPath(), protectedFile.toPath()); }
        catch (UnsupportedOperationException | java.io.IOException | SecurityException unavailable) { Assume.assumeNoException(unavailable); }
        try { UpdateCacheStorage.clear(base); fail("Linked target should fail"); }
        catch (UpdateCacheStorage.Failure error) { assertEquals("CACHE_UNSAFE_PATH", error.code); }
        assertEquals(41, protectedFile.length());
    }
}
