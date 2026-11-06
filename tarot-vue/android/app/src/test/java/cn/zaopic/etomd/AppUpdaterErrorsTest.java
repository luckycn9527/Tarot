package cn.zaopic.etomd;

import static org.junit.Assert.*;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.file.Files;
import javax.net.ssl.SSLException;
import org.junit.Test;

/** Exercise real I/O failures without network access, installers or Android permissions. */
public class AppUpdaterErrorsTest {
    private static Object call(String name, Class<?>[] parameters, Object... arguments) throws Exception {
        Method method = AppUpdaterPlugin.class.getDeclaredMethod(name, parameters);
        method.setAccessible(true);
        try { return method.invoke(null, arguments); }
        catch (InvocationTargetException e) { throw (Exception) e.getCause(); }
    }
    private static String code(Exception error) throws Exception {
        return (String) call("code", new Class<?>[] { Exception.class }, error);
    }
    private static Exception fails(String name, Class<?>[] parameters, Object... arguments) throws Exception {
        try { call(name, parameters, arguments); fail("Expected a failed operation"); return null; }
        catch (Exception error) { return error; }
    }

    @Test public void networkAndSecureConnectionFailuresRemainDistinct() throws Exception {
        assertEquals("NETWORK_ERROR", code(new SocketTimeoutException()));
        assertEquals("NETWORK_ERROR", code(new UnknownHostException()));
        assertEquals("NETWORK_ERROR", code(new ConnectException()));
        assertEquals("SECURE_CONNECTION_ERROR", code(new SSLException("private TLS diagnostics")));
        assertEquals("UPDATE_FAILED", code(new IllegalStateException("private diagnostics")));
        String detail = (String) call("detail", new Class<?>[] { Exception.class }, new IOException("private device path"));
        assertFalse(detail.contains("private"));
    }

    @Test public void interruptedBodyAndTlsBodyUseDifferentRecoveryReasons() throws Exception {
        InputStream disconnected = new InputStream() {
            @Override public int read() throws IOException { throw new IOException("socket closed"); }
        };
        InputStream insecure = new InputStream() {
            @Override public int read() throws IOException { throw new SSLException("connection changed"); }
        };
        Class<?>[] signature = { InputStream.class, byte[].class };
        assertEquals("NETWORK_ERROR", code(fails("readDownload", signature, disconnected, new byte[8])));
        assertEquals("SECURE_CONNECTION_ERROR", code(fails("readDownload", signature, insecure, new byte[8])));
    }

    @Test public void localOpenAndWriteFailuresAreStorageErrors() throws Exception {
        File directory = Files.createTempDirectory("etomd-update-errors").toFile();
        File file = new File(directory, "update.apk");
        try {
            File missingParent = new File(directory, "missing/update.apk");
            assertEquals("STORAGE_ERROR", code(fails("updateOutput", new Class<?>[] { File.class }, missingParent)));
            try (FileOutputStream output = new FileOutputStream(file) {
                @Override public void write(byte[] buffer, int offset, int count) throws IOException { throw new IOException("disk full"); }
            }) {
                assertEquals("STORAGE_ERROR", code(fails("writeUpdate", new Class<?>[] { FileOutputStream.class, byte[].class, int.class }, output, new byte[] { 1 }, 1)));
            }
        } finally { file.delete(); directory.delete(); }
    }
}
