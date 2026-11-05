"""Narrow domestic APK/feed publisher. Default/--inspect is strictly read-only.

This file is prepared for review; preparing or importing it never connects.
Only --publish writes four public static files; no application/service changes.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import urllib.request
import uuid

WORKSPACE = Path(__file__).resolve().parents[2]
ORIGIN = 'https://121.40.27.226:9443'
HOST = '121.40.27.226'

# Executed by the remote Python interpreter with one JSON request on stdin.
# This program has no shell commands, subprocesses, service or database calls.
REMOTE_PROGRAM = r'''
import hashlib, json, os, re, shutil, sys
from pathlib import Path
ROOT = Path('/var/www/tarot.zaopic.cn/dist')
DOWNLOADS = ROOT / 'downloads'
STAGES = Path('/home/workspace/toart/Tarot/.releases')
NGINX = Path('/etc/nginx/conf.d/tarot-temporary-tunnel.conf')
ORIGIN = 'https://121.40.27.226:9443'
FEED = 'android-latest.json'

def digest(data): return hashlib.sha256(data).hexdigest()
def require(condition, message):
    if not condition: raise RuntimeError(message)
def regular(path):
    require(path.is_file() and not path.is_symlink(), 'Expected regular non-symlink file: '+path.name)
def small_json(path):
    regular(path)
    require(path.stat().st_size <= 131072, 'JSON exceeds limit')
    return json.loads(path.read_text(encoding='utf-8'))
def valid_timestamp(value):
    if not isinstance(value,str): return False
    match=re.fullmatch(r'([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,3})?(Z|[+-]([0-9]{2}):([0-9]{2}))',value)
    if not match: return False
    year,month,day,hour,minute,second=map(int,match.groups()[:6])
    days=[31,29 if year%4==0 and (year%100!=0 or year%400==0) else 28,31,30,31,30,31,31,30,31,30,31]
    return 1<=month<=12 and 1<=day<=days[month-1] and hour<=23 and minute<=59 and second<=59 and (match[7]=='Z' or (int(match[8])<=23 and int(match[9])<=59))
def validate_feed(feed):
    require(type(feed.get('schema')) is int and feed.get('schema') == 1 and feed.get('site') == 'domestic' and feed.get('applicationId') == 'cn.zaopic.etomd', 'Invalid feed application identity')
    version = feed.get('version', '')
    require(isinstance(version,str) and re.fullmatch(r'(?:0|[1-9][0-9]{0,3})\.(?:0|[1-9][0-9]{0,3})\.(?:0|[1-9][0-9]{0,3})',version), 'Invalid version')
    for field, low, high in [('versionCode',1,2100000000),('minSdk',24,100),('bytes',1048576,209715200)]:
        value=feed.get(field)
        require(type(value) is int and low <= value <= high, 'Invalid '+field)
    require(isinstance(feed.get('sha256'),str) and re.fullmatch(r'[a-f0-9]{64}',feed['sha256']), 'Invalid SHA256')
    require(feed.get('downloadUrl') == ORIGIN+'/downloads/E-Tomd-'+version+'-domestic-debug.apk', 'Invalid download URL')
    for field in ['releaseNotes','releaseNotesEn']:
        if field not in feed and field == 'releaseNotesEn': continue
        value=feed.get(field)
        require(isinstance(value,list) and 1 <= len(value) <= 30 and all(isinstance(x,str) and x.strip() and len(x.encode('utf-16-le','surrogatepass'))//2<=500 and not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',x) for x in value), 'Invalid '+field)
    require(valid_timestamp(feed.get('publishedAt')), 'Invalid publication timestamp')
    return ['E-Tomd-'+version+'-domestic-debug.apk','E-Tomd-'+version+'-domestic-debug.apk.sha256','E-Tomd-'+version+'-domestic-release.json',FEED]
def validate_destination():
    require(ROOT.is_dir() and not ROOT.is_symlink() and ROOT.resolve()==ROOT, 'Static root changed; inspect deployment before publishing')
    require(DOWNLOADS.is_dir() and not DOWNLOADS.is_symlink() and DOWNLOADS.resolve()==ROOT/'downloads', 'Download directory changed or missing')
    require(STAGES.is_dir() and not STAGES.is_symlink() and STAGES.resolve()==STAGES, 'Release stage base changed or missing')
    regular(NGINX)
    config=NGINX.read_text(encoding='utf-8')
    clean='\n'.join(line.split('#',1)[0] for line in config.splitlines())
    require(re.search(r'\blisten\s+9443\s+ssl\s*;',clean), 'Expected HTTPS 9443 listener missing')
    require(re.search(r'\broot\s+'+re.escape(str(ROOT))+r'\s*;',clean), 'Expected static root missing from HTTPS configuration')
    current=DOWNLOADS/FEED
    previous=small_json(current) if current.exists() else None
    if previous is not None: validate_feed(previous)
    return {'downloads':str(DOWNLOADS.resolve()),'nginxSha256':digest(config.encode()),'previousFeed':previous,'previousFeedSha256':digest(current.read_bytes()) if current.exists() else None}
def stage_path(run_id):
    require(isinstance(run_id,str) and re.fullmatch(r'[0-9a-f]{32}',run_id), 'Invalid run id')
    stage=STAGES/('updater-20261029-'+run_id)
    require(not stage.is_symlink() and stage.parent==STAGES,'Invalid stage')
    return stage
def prepare(run_id):
    proof=validate_destination()
    stage=stage_path(run_id)
    stage.mkdir(mode=0o700)
    (stage/'preflight.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.chmod(stage/'preflight.json',0o600)
    return {'stage':str(stage),'preflight':proof}
def validate_bundle(stage):
    feed=small_json(stage/FEED)
    names=validate_feed(feed)
    for name in names: regular(stage/name)
    apk=stage/names[0]
    require(apk.stat().st_size==feed['bytes'],'APK size mismatch')
    require(digest(apk.read_bytes())==feed['sha256'],'APK SHA256 mismatch')
    require((stage/names[1]).read_text() == feed['sha256']+'  '+names[0]+'\n','Checksum mismatch')
    release=small_json(stage/names[2])
    for field in ['version','versionCode','site','applicationId','bytes','sha256']:
        require(release.get(field)==feed[field],'Release metadata mismatch: '+field)
    require(release.get('filename')==names[0] and release.get('apiOrigin')==ORIGIN and release.get('platform')=='android' and release.get('buildType')=='debug' and release.get('bundled') is True,'Invalid release metadata')
    return feed,names
def durable_copy(source,destination):
    with source.open('rb') as src, destination.open('xb') as dst:
        shutil.copyfileobj(src,dst,1024*1024)
        dst.flush(); os.fsync(dst.fileno())
    os.chmod(destination,0o644)
    require(digest(source.read_bytes())==digest(destination.read_bytes()),'Copied file differs')
def commit(run_id):
    import fcntl
    proof=validate_destination()
    stage=stage_path(run_id)
    require(stage.is_dir(),'Missing upload stage')
    before=small_json(stage/'preflight.json')
    require(before['nginxSha256']==proof['nginxSha256'],'Nginx configuration changed after preflight')
    feed,names=validate_bundle(stage)
    lock=STAGES/'.android-update-publish.lock'
    require(not lock.is_symlink(),'Invalid publication lock')
    with lock.open('a+b') as handle:
        os.chmod(lock,0o600); fcntl.flock(handle,fcntl.LOCK_EX)
        current=DOWNLOADS/FEED
        current_bytes=current.read_bytes() if current.exists() else None
        current_hash=digest(current_bytes) if current_bytes is not None else None
        require(current_hash==before['previousFeedSha256'],'Feed changed after preflight; start a fresh publication')
        previous=json.loads(current_bytes) if current_bytes is not None else None
        if previous is not None:
            validate_feed(previous)
            require(feed['versionCode']>previous['versionCode'] or current_bytes==(stage/FEED).read_bytes(),'Refusing a non-increasing update feed')
        # Check all versioned destinations before changing any public file.
        for name in names[:-1]:
            target=DOWNLOADS/name
            if target.exists():
                regular(target)
                require(target.read_bytes()==(stage/name).read_bytes(),'Immutable versioned filename already differs: '+name)
        before_other={p.name:digest(p.read_bytes()) for p in DOWNLOADS.iterdir() if p.is_file() and p.name not in names}
        for name in names[:-1]:
            target=DOWNLOADS/name
            if target.exists(): continue
            temporary=DOWNLOADS/('.'+name+'.'+run_id+'.uploading')
            durable_copy(stage/name,temporary)
            try:
                os.link(temporary,target) # Atomic creation; cannot overwrite a race winner.
            except FileExistsError:
                regular(target)
                require(target.read_bytes()==(stage/name).read_bytes(),'Concurrent versioned file differs')
            finally:
                temporary.unlink()
        if current_bytes is not None:
            backup=stage/'android-latest.before.json'
            with backup.open('xb') as handle:
                handle.write(current_bytes); handle.flush(); os.fsync(handle.fileno())
            os.chmod(backup,0o600)
        require((digest(current.read_bytes()) if current.exists() else None)==current_hash,'Feed changed while staging versioned files')
        # Persist rollback identity before the public pointer changes. Even a
        # post-replace verification failure retains a concrete recovery record.
        receipt={'runId':run_id,'version':feed['version'],'versionCode':feed['versionCode'],'publishedFeedSha256':digest((stage/FEED).read_bytes()),'previousFeedSha256':current_hash,'files':[{ 'name':name,'bytes':(stage/name).stat().st_size,'sha256':digest((stage/name).read_bytes()) } for name in names],'previousDownloadFilesUnchanged':None,'status':'prepared'}
        with (stage/'publication.json').open('x',encoding='utf-8') as handle:
            handle.write(json.dumps(receipt,indent=2)+'\n'); handle.flush(); os.fsync(handle.fileno())
        os.chmod(stage/'publication.json',0o600)
        temporary=DOWNLOADS/('.android-latest.'+run_id+'.uploading')
        durable_copy(stage/FEED,temporary)
        os.replace(temporary,current) # Feed is last, atomically.
        require(current.read_bytes()==(stage/FEED).read_bytes(),'Published feed mismatch')
        after_other={p.name:digest(p.read_bytes()) for p in DOWNLOADS.iterdir() if p.is_file() and p.name not in names}
        require(before_other==after_other,'An unrelated download file changed')
        receipt.update(previousDownloadFilesUnchanged=True,status='published')
        (stage/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n')
        os.chmod(stage/'publication.json',0o600)
        return receipt
def rollback(run_id):
    import fcntl
    validate_destination()
    stage=stage_path(run_id)
    receipt=small_json(stage/'publication.json')
    current=DOWNLOADS/FEED
    lock=STAGES/'.android-update-publish.lock'
    require(not lock.is_symlink(),'Invalid publication lock')
    with lock.open('a+b') as handle:
        fcntl.flock(handle,fcntl.LOCK_EX)
        regular(current)
        require(digest(current.read_bytes())==receipt['publishedFeedSha256'],'Feed changed; refusing rollback over another release')
        if receipt['previousFeedSha256'] is None:
            current.unlink()
        else:
            backup=stage/'android-latest.before.json'
            regular(backup)
            require(digest(backup.read_bytes())==receipt['previousFeedSha256'],'Backup differs')
            temporary=DOWNLOADS/('.android-latest.'+run_id+'.rollback')
            durable_copy(backup,temporary)
            os.replace(temporary,current)
    return {'rolledBackFeedOnly':True,'versionedApksRetained':True,'runId':run_id}
def main(request):
    action=request.get('action')
    if action=='inspect': return validate_destination()
    if action=='prepare': return prepare(request.get('runId'))
    if action=='commit': return commit(request.get('runId'))
    if action=='rollback': return rollback(request.get('runId'))
    raise RuntimeError('Unsupported action')
if __name__=='__main__':
    print(json.dumps(main(json.loads(sys.stdin.read())),ensure_ascii=False))
'''


def connect():
    import paramiko
    client = paramiko.SSHClient()
    client.load_host_keys(str(Path.home() / '.ssh/known_hosts'))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(HOST, username='root', key_filename=str(WORKSPACE / '.codex-deploy/tarot-deploy_ed25519'),
                   look_for_keys=False, allow_agent=False, timeout=20)
    return client


def remote(client, action, run_id=None):
    stdin, stdout, stderr = client.exec_command('python3 -c ' + shlex.quote(REMOTE_PROGRAM), timeout=180)
    stdin.write(json.dumps({'action': action, 'runId': run_id}))
    stdin.channel.shutdown_write()
    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    code = stdout.channel.recv_exit_status()
    if code:
        raise RuntimeError('Static publication command failed: ' + error[-3000:])
    return json.loads(output)


def bundle_files(directory):
    directory = Path(directory).resolve()
    feed = json.loads((directory / 'android-latest.json').read_text(encoding='utf-8'))
    namespace = {'__name__': 'local_feed_validation'}
    exec(compile(REMOTE_PROGRAM, '<remote-static-publisher>', 'exec'), namespace)
    names = namespace['validate_feed'](feed)
    namespace['validate_bundle'](directory)
    return directory, feed, names


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Unexpected redirect from the fixed public download URL')


def verify_public(directory, feed, names):
    opener = urllib.request.build_opener(NoRedirect())
    proof = []
    for name in names:
        local_data = (directory / name).read_bytes()
        url = ORIGIN + '/downloads/' + name
        with opener.open(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=60) as response:
            if response.status != 200:
                raise RuntimeError('Static public file did not return 200: ' + name)
            remote_data = response.read(len(local_data) + 1)
            if remote_data != local_data:
                raise RuntimeError('Public static bytes differ: ' + name)
            proof.append({'name': name, 'status': response.status, 'bytes': len(remote_data),
                          'sha256': hashlib.sha256(remote_data).hexdigest()})
    return {'version': feed['version'], 'versionCode': feed['versionCode'], 'httpsVerified': True, 'files': proof}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--inspect', action='store_true')
    modes.add_argument('--publish', action='store_true')
    modes.add_argument('--verify', action='store_true')
    modes.add_argument('--rollback', metavar='RUN_ID')
    parser.add_argument('--bundle', type=Path)
    arguments = parser.parse_args()
    if arguments.publish or arguments.verify:
        if arguments.bundle is None:
            parser.error('--bundle is required for --publish/--verify')
        directory, feed, names = bundle_files(arguments.bundle)
    if arguments.verify:
        print(json.dumps(verify_public(directory, feed, names), ensure_ascii=False, indent=2))
        return
    with connect() as client:
        if arguments.publish:
            run_id = uuid.uuid4().hex
            prepared = remote(client, 'prepare', run_id)
            with client.open_sftp() as sftp:
                for name in names:
                    destination = prepared['stage'] + '/' + name
                    with (directory / name).open('rb') as source, sftp.open(destination, 'wxb') as target:
                        while block := source.read(1024 * 1024):
                            target.write(block)
                    sftp.chmod(destination, 0o600)
            print(json.dumps({'preparedRunId':run_id,'remoteStage':prepared['stage']},ensure_ascii=False),flush=True)
            receipt = remote(client, 'commit', run_id)
            # Save the concrete rollback identity before doing public verification.
            receipt_path = directory / ('publication-' + run_id + '.json')
            receipt_path.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
            print(json.dumps({'published': receipt, 'receipt': str(receipt_path),
                              'publicProof': verify_public(directory, feed, names)}, ensure_ascii=False, indent=2))
        elif arguments.rollback:
            if not re.fullmatch(r'[0-9a-f]{32}', arguments.rollback):
                parser.error('Invalid rollback run id')
            print(json.dumps(remote(client, 'rollback', arguments.rollback), indent=2))
        else:
            print(json.dumps(remote(client, 'inspect'), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
