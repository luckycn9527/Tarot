// Uses randomly prefixed copies of tables, never the serving site's users/settings/history.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
if(!process.argv.includes('--allow-isolated-database-tests'))throw Error('Requires --allow-isolated-database-tests and a database backup');
const require=createRequire(process.cwd()+'/package.json');require('dotenv').config();
process.env.NODE_ENV='test';process.env.REDIS_URL='';process.env.AI_RATE_LIMIT_PER_MIN='60';
// This inert value is never sent to a network endpoint; the upstream fetch is replaced below.
process.env.DEEPSEEK_API_KEY='inert-mobile-test-key';
const root=process.env.FLOW_CODE_ROOT||process.cwd();
const [{pool},{signAccessToken},{quotaWindow},{env},RequestModel,MobileService]=await Promise.all([
  import(pathToFileURL(root+'/dist/config/database.js')),import(pathToFileURL(root+'/dist/utils/jwt.js')),
  import(pathToFileURL(root+'/dist/utils/quotaDate.js')),import(pathToFileURL(root+'/dist/config/env.js')),
  import(pathToFileURL(root+'/dist/models/mobileRequest.model.js')),
  import(pathToFileURL(root+'/dist/services/mobileReading.service.js')),
]);
const prefix=`mob_test_${randomBytes(6).toString('hex')}_`;
assert.match(prefix,/^mob_test_[a-f0-9]{12}_$/);
const tables=['users','refresh_tokens','reading_history_cards','reading_history','reference_tarot_readers','reference_spreads','reader_prompts_config','mobile_ai_requests'];
const names=tables.map(name=>prefix+name),created=[];
const realQuery=pool.query.bind(pool),realExecute=pool.execute.bind(pool),realGet=pool.getConnection.bind(pool);
const original={query:pool.query,execute:pool.execute,getConnection:pool.getConnection};
const pattern=new RegExp(`\\b(${tables.join('|')})\\b`,'g');
const rewrite=sql=>typeof sql==='string'?sql.replace(pattern,name=>prefix+name):{...sql,sql:sql.sql.replace(pattern,name=>prefix+name)};
const originalFetch=globalThis.fetch;
let server=null,upstreamCalls=0,failNext=false,gate=null,rejectNextCompletion=false;
function wrap(connection){return new Proxy(connection,{get(target,key){
  if(key==='query'||key==='execute')return(sql,...args)=>{
    if(rejectNextCompletion&&String(sql).includes("UPDATE mobile_ai_requests SET status = 'succeeded'")){
      rejectNextCompletion=false;throw Error('Fixture completion failure after history persistence');
    }
    return target[key](rewrite(sql),...args);
  };
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
}})}
async function waitFor(check){for(let i=0;i<160;i++){const value=await check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Test fixture task did not finish');}
try{
  for(const table of tables){const fixture=prefix+table;await realQuery(`CREATE TABLE \`${fixture}\` LIKE \`${table}\``);created.push(fixture);}
  const [foreignKeys]=await realQuery(`SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${names.map(()=>'?').join(',')}) AND REFERENCED_TABLE_NAME IS NOT NULL`,names);
  assert.equal(foreignKeys.length,0,'Fixture copies must not point to serving business tables');
  pool.query=(sql,...args)=>realQuery(rewrite(sql),...args);pool.execute=(sql,...args)=>realExecute(rewrite(sql),...args);pool.getConnection=async()=>wrap(await realGet());
  const bcrypt=require('bcryptjs'),password='inert-mobile-fixture-password',passwordHash=await bcrypt.hash(password,4);
  const owner=2_000_000_000+Math.floor(Math.random()*100_000),other=owner+1,vip=owner+2;
  const day=quotaWindow(env.QUOTA_TIME_ZONE).businessDate;
  for(const id of [owner,other,vip])await pool.execute(
    'INSERT INTO users (id,email,username,nickname,password_hash,membership,remaining_free_quota,quota_reset_date) VALUES (?,?,?,?,?,?,?,?)',
    [id,`mobile-${id}@example.invalid`,`mobile_${id}`,'Mobile fixture',passwordHash,id===vip?'vip':'free',20,day]);
  await pool.execute("INSERT INTO reference_tarot_readers (code,display_name) VALUES ('qinghe','Fixture reader')");
  await pool.execute("INSERT INTO reference_spreads (code,display_name) VALUES ('single','Single'),('problem','Three')");
  globalThis.fetch=async(url,options)=>{
    if(String(url)===env.DEEPSEEK_BASE_URL+'/chat/completions'){
      upstreamCalls++;if(gate)await gate.promise;
      if(failNext){failNext=false;return new Response(JSON.stringify({error:{message:'fixture failure'}}),{status:503});}
      const input=JSON.parse(options.body);
      const content=input.max_tokens===4096?JSON.stringify({messages:[{type:'reading',content:'Fixture interpretation'}],summary:'Fixture summary'}):'Fixture followup answer';
      return new Response(JSON.stringify({choices:[{message:{content}}]}),{status:200,headers:{'content-type':'application/json'}});
    }
    return originalFetch(url,options);
  };
  const express=require('express'),cors=require('cors');const app=express();app.use(express.json());
  app.use(cors((await import(pathToFileURL(root+'/dist/config/cors.js'))).corsOptions));
  app.use('/api/auth',(await import(pathToFileURL(root+'/dist/routes/auth.routes.js'))).default);
  app.use('/api/mobile',(await import(pathToFileURL(root+'/dist/routes/mobile.routes.js'))).default);
  app.use('/api/readings',(await import(pathToFileURL(root+'/dist/routes/reading.routes.js'))).default);
  app.use((await import(pathToFileURL(root+'/dist/middleware/errorHandler.js'))).errorHandler);
  server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const token=signAccessToken({userId:owner}),otherToken=signAccessToken({userId:other}),vipToken=signAccessToken({userId:vip});
  async function api(path,method='GET',body,access=token){
    const response=await originalFetch(origin+'/api'+path,{method,headers:{'content-type':'application/json',origin:'https://localhost',...(access?{authorization:`Bearer ${access}`}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
    return{status:response.status,body:await response.json(),headers:response.headers};
  }
  const quota=async(id=owner)=>Number((await pool.query('SELECT remaining_free_quota AS n FROM users WHERE id=?',[id]))[0][0].n);
  const count=async(table)=>Number((await pool.query(`SELECT COUNT(*) AS n FROM ${table}`))[0][0].n);
  const reading=(requestId=randomUUID())=>({requestId,readerId:'qinghe',spreadType:'single',question:'Fixture original question?',category:'其他',locale:'zh-CN',cardIds:[0],orientations:['upright']});
  const terminal=async(id,access=token)=>waitFor(async()=>{const result=await api('/mobile/requests/'+id,'GET',undefined,access);return result.status===200&&result.body.data.status!=='running'?result:null;});
  assert.equal((await api('/mobile/readings','POST',reading(),null)).status,401);
  assert.equal((await api('/mobile/readings','POST',{...reading(),cardIds:[78]})).status,400);
  assert.equal((await api('/mobile/readings','POST',{...reading(),spreadType:'problem',cardIds:[0,0,1],orientations:['upright','upright','upright']})).status,400);
  assert.equal(await quota(),20);
  let releaseGate;gate={promise:new Promise(resolve=>{releaseGate=resolve})};gate.release=releaseGate;
  const first=reading(),accepted=await api('/mobile/readings','POST',first);assert.equal(accepted.status,202);assert.equal(accepted.headers.get('retry-after'),'5');assert.equal(accepted.headers.get('cache-control'),'no-store');
  await waitFor(()=>upstreamCalls===1);
  const retries=await Promise.all(Array.from({length:4},()=>api('/mobile/readings','POST',first)));
  assert.ok(retries.every(result=>result.status===202));assert.equal(upstreamCalls,1);assert.equal(await quota(),19);
  assert.equal((await api('/mobile/readings','POST',{...first,question:'Different fixture question?'})).status,409);
  assert.equal((await api('/mobile/requests/'+first.requestId,'GET',undefined,otherToken)).status,404);
  assert.equal((await api('/mobile/readings','POST',reading())).status,429);
  releaseGate();gate=null;
  const completed=await terminal(first.requestId);assert.equal(completed.body.data.status,'succeeded');assert.equal(completed.body.data.result.cards[0].id,0);
  const historyId=completed.body.data.historyId;assert.equal(await count('reading_history'),1);assert.equal(await quota(),19);
  assert.deepEqual((await api('/mobile/readings','POST',first)).body,completed.body);assert.equal(upstreamCalls,1);
  const detail=await api(`/readings/history/${historyId}`);assert.equal(detail.status,200);assert.equal(detail.body.data.question,first.question);
  assert.equal((await api(`/readings/history/${historyId}`,'GET',undefined,otherToken)).status,404);
  const followup={requestId:randomUUID(),readingId:historyId,question:'What can I do next?',locale:'en-US'};
  assert.equal((await api('/mobile/followups','POST',followup)).status,202);
  const followed=await terminal(followup.requestId);assert.equal(followed.body.data.result.answer,'Fixture followup answer');
  assert.equal((await api('/mobile/followups','POST',followup)).body.data.status,'succeeded');assert.equal(upstreamCalls,2);assert.equal(await quota(),18);
  const updated=(await api(`/readings/history/${historyId}`)).body.data;assert.equal(updated.resultData.followups.length,1);assert.equal(updated.resultData.followups[0].requestId,followup.requestId);
  const three={...reading(),spreadType:'problem',cardIds:[0,1,2],orientations:['upright','reversed','upright']};
  assert.equal((await api('/mobile/readings','POST',three)).status,202);assert.equal((await terminal(three.requestId)).body.data.result.cards.length,3);assert.equal(await quota(),17);
  const beforeFailed=await quota(),failed=reading();failNext=true;
  assert.equal((await api('/mobile/readings','POST',failed)).status,202);const failedResult=await terminal(failed.requestId);
  assert.equal(failedResult.body.data.status,'failed');assert.equal(await quota(),beforeFailed);
  const callsAfterFailure=upstreamCalls;assert.equal((await api('/mobile/readings','POST',failed)).body.data.status,'failed');assert.equal(upstreamCalls,callsAfterFailure);
  const beforeAtomicCount=await count('reading_history'),beforeAtomicQuota=await quota(),atomicFailure=reading();rejectNextCompletion=true;
  assert.equal((await api('/mobile/readings','POST',atomicFailure)).status,202);
  assert.equal((await terminal(atomicFailure.requestId)).body.data.status,'failed');
  assert.equal(await count('reading_history'),beforeAtomicCount,'History and request status must commit together');
  assert.equal(await quota(),beforeAtomicQuota,'A failed completion must release exactly its reservation');
  // A killed process leaves its durable reservation; expiration refunds exactly once.
  const abandoned=await RequestModel.claim(owner,randomUUID(),'reading','d'.repeat(64),day);assert.equal(await quota(),beforeFailed-1);
  await pool.execute('UPDATE mobile_ai_requests SET lease_expires_at=? WHERE user_id=? AND request_id=?',[new Date(Date.now()-1000),owner,abandoned.task.request_id]);
  const recovered=await api('/mobile/requests/'+abandoned.task.request_id);assert.equal(recovered.body.data.status,'failed');assert.equal(recovered.body.data.error.code,'request_interrupted');
  assert.equal(await quota(),beforeFailed);await api('/mobile/requests/'+abandoned.task.request_id);assert.equal(await quota(),beforeFailed);
  await assert.rejects(RequestModel.complete(abandoned.task,async()=>{throw Error('Late job must not enter persistence');}),/任务已结束/);
  const vipBefore=await quota(vip),vipReading=reading();assert.equal((await api('/mobile/readings','POST',vipReading,vipToken)).status,202);await terminal(vipReading.requestId,vipToken);assert.equal(await quota(vip),vipBefore);
  // Reference configuration changes cannot silently give a free user a VIP-only reader.
  await pool.execute("INSERT INTO reader_prompts_config (reader_code,system_prompt,greeting,access_level) VALUES ('qinghe','Fixture prompt','Fixture greeting','vip')");
  const restricted=reading(),beforeRestricted=await quota();await api('/mobile/readings','POST',restricted);const denied=await terminal(restricted.requestId);
  assert.equal(denied.body.data.status,'failed');assert.equal(denied.body.data.error.message,'该塔罗师仅限VIP会员使用');assert.equal(await quota(),beforeRestricted);
  await pool.execute('DELETE FROM reader_prompts_config');
  // A history removal cannot expose deleted AI text or regenerate the original UUID.
  await pool.execute('DELETE FROM reading_history WHERE id=? AND user_id=?',[historyId,owner]);
  const removed=await api('/mobile/requests/'+first.requestId);assert.equal(removed.body.data.error.code,'history_removed');assert.equal(removed.body.data.result,undefined);
  assert.equal((await api('/mobile/readings','POST',first)).body.data.status,'failed');
  // Native refresh must rotate once, retain other devices and avoid cookies.
  const loginBody={identifier:`mobile_${owner}`,password};
  const login=await api('/auth/native/login','POST',loginBody,null);assert.equal(login.status,200);assert.equal(login.headers.get('set-cookie'),null);assert.equal(login.headers.get('cache-control'),'no-store');
  const sessionA=login.body.data,sessionB=(await api('/auth/native/login','POST',loginBody,null)).body.data;
  const rotations=await Promise.all([api('/auth/native/refresh','POST',{refreshToken:sessionA.refreshToken},null),api('/auth/native/refresh','POST',{refreshToken:sessionA.refreshToken},null)]);
  assert.deepEqual(rotations.map(result=>result.status).sort(),[200,401]);
  const rotated=rotations.find(result=>result.status===200).body.data;
  assert.equal((await api('/auth/native/logout','POST',{refreshToken:sessionB.refreshToken},otherToken)).status,401);
  assert.equal((await api('/auth/native/logout','POST',{refreshToken:rotated.refreshToken},rotated.accessToken)).status,200);
  assert.equal((await api('/auth/native/refresh','POST',{refreshToken:sessionB.refreshToken},null)).status,200);
  const [[sessions]]=await pool.query('SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id=?',[owner]);assert.equal(Number(sessions.n),1);
  console.log(JSON.stringify({mobileIntegration:'passed',isolatedTables:true,realAiCalls:0,cardZero:true,threeCards:true,
    idempotentReading:true,idempotentFollowup:true,payloadConflict:true,oneQuotaPerTask:true,failedQuotaRefunded:true,
    interruptedQuotaRefundedOnce:true,atomicHistoryAndTask:true,lateCompletionRejected:true,historyOwnership:true,deletedHistoryNotReplayed:true,
    configuredVipReaderEnforced:true,nativeLogin:true,atomicRefreshRotation:true,otherDevicesPreserved:true,realBusinessTableWrites:0}));
}finally{
  if(gate){gate.release();gate=null;}
  await MobileService.waitForIdle();
  if(server)await new Promise(resolve=>server.close(resolve));globalThis.fetch=originalFetch;Object.assign(pool,original);
  for(const name of created.reverse()){assert.ok(names.includes(name)&&name.startsWith(prefix));await realQuery(`DROP TABLE IF EXISTS \`${name}\``);}
  const [remaining]=await realQuery(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${names.map(()=>'?').join(',')})`,names);
  assert.equal(remaining.length,0);await pool.end();console.log(JSON.stringify({mobileFixtureTablesRemoved:true}));
}
