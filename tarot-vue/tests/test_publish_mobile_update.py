"""Local filesystem tests only. No SSH connections or HTTP requests."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ENTRY = Path(__file__).resolve().parents[1] / 'scripts/publish-mobile-update.py'
spec = importlib.util.spec_from_file_location('publisher_under_test', ENTRY)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class StaticPublicationTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='updater-static-', dir=ENTRY.parent)
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / 'dist'
        self.downloads = self.root / 'downloads'
        self.stages = self.base / '.releases'
        self.nginx = self.base / 'temporary.conf'
        self.downloads.mkdir(parents=True)
        self.stages.mkdir()
        self.nginx.write_text('server {\n listen 9443 ssl;\n root '+str(self.root)+';\n}\n')
        self.scope = {'__name__': 'local_test'}
        exec(compile(publisher.REMOTE_PROGRAM, '<remote-program>', 'exec'), self.scope)
        self.scope.update(ROOT=self.root, DOWNLOADS=self.downloads, STAGES=self.stages, NGINX=self.nginx)
        # File locking itself is supplied by Linux in production. These Windows
        # tests exercise the publication policy and exact filesystem mutations.
        self.lock = patch.dict(sys.modules, {'fcntl': types.SimpleNamespace(LOCK_EX=2, LOCK_UN=8, flock=lambda *args: None)})
        self.lock.start()

    def tearDown(self):
        self.lock.stop()
        self.temporary.cleanup()

    def stage(self, run='a'*32, version='0.1.8', code=9):
        prepared = self.scope['prepare'](run)
        stage = Path(prepared['stage'])
        apk = b'A' * (1024 * 1024)
        sha = hashlib.sha256(apk).hexdigest()
        filename = 'E-Tomd-'+version+'-domestic-debug.apk'
        feed = {'schema':1,'site':'domestic','applicationId':'cn.zaopic.etomd','version':version,'versionCode':code,
                'minSdk':24,'bytes':len(apk),'sha256':sha,'downloadUrl':publisher.ORIGIN+'/downloads/'+filename,
                'releaseNotes':['应用内更新'],'publishedAt':'2026-10-29T12:00:00.000Z'}
        release = {key:feed[key] for key in ['version','versionCode','site','applicationId','bytes','sha256']}
        release.update(filename=filename,apiOrigin=publisher.ORIGIN,platform='android',buildType='debug',bundled=True)
        (stage/filename).write_bytes(apk)
        (stage/(filename+'.sha256')).write_text(sha+'  '+filename+'\n')
        (stage/('E-Tomd-'+version+'-domestic-release.json')).write_text(json.dumps(release))
        (stage/'android-latest.json').write_text(json.dumps(feed))
        return stage,filename,feed

    def test_publish_feed_last_and_rollback_retains_apk(self):
        unrelated=self.downloads/'old.apk'
        unrelated.write_bytes(b'old-version-unchanged')
        stage,filename,feed=self.stage()
        receipt=self.scope['commit']('a'*32)
        self.assertTrue(receipt['previousDownloadFilesUnchanged'])
        self.assertEqual(json.loads((self.downloads/'android-latest.json').read_text()),feed)
        self.assertEqual(unrelated.read_bytes(),b'old-version-unchanged')
        result=self.scope['rollback']('a'*32)
        self.assertTrue(result['rolledBackFeedOnly'])
        self.assertFalse((self.downloads/'android-latest.json').exists())
        self.assertTrue((self.downloads/filename).exists())

    def test_immutable_filename_conflict_does_not_change_feed(self):
        stage,filename,feed=self.stage()
        (self.downloads/filename).write_bytes(b'conflicting-bytes')
        with self.assertRaisesRegex(RuntimeError,'Immutable'):
            self.scope['commit']('a'*32)
        self.assertFalse((self.downloads/'android-latest.json').exists())
        self.assertEqual((self.downloads/filename).read_bytes(),b'conflicting-bytes')

    def test_monotonic_feed_and_rollback_guard(self):
        first,_,_=self.stage()
        self.scope['commit']('a'*32)
        second,_,_=self.stage('b'*32,'0.1.9',10)
        self.scope['commit']('b'*32)
        current=(self.downloads/'android-latest.json').read_bytes()
        with self.assertRaisesRegex(RuntimeError,'Feed changed'):
            self.scope['rollback']('a'*32)
        _,_,_=self.stage('c'*32,'0.1.7',8)
        with self.assertRaisesRegex(RuntimeError,'non-increasing'):
            self.scope['commit']('c'*32)
        self.assertEqual((self.downloads/'android-latest.json').read_bytes(),current)
        self.scope['rollback']('b'*32)
        self.assertEqual((self.downloads/'android-latest.json').read_bytes(),(first/'android-latest.json').read_bytes())

    def test_concurrent_feed_change_or_apk_corruption_aborts(self):
        stage,filename,_=self.stage()
        (stage/filename).write_bytes(b'bad')
        with self.assertRaisesRegex(RuntimeError,'size mismatch'):
            self.scope['commit']('a'*32)
        self.assertFalse((self.downloads/'android-latest.json').exists())
        stage,_,feed=self.stage('b'*32)
        (self.downloads/'android-latest.json').write_text(json.dumps(feed))
        with self.assertRaisesRegex(RuntimeError,'Feed changed after preflight'):
            self.scope['commit']('b'*32)


if __name__=='__main__':
    unittest.main()
