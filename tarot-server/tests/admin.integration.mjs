// Opt-in integration checks. Creates and cleans only its own fixture accounts;
// never calls external Google, AI, email or payment services.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
if(!process.argv.includes('--allow-database-writes'))throw new Error('Back up the target and pass --allow-database-writes');
const require=createRequire(process.cwd()+'/package.json');
require('dotenv').config();
process.env.GOOGLE_CLIENT_ID='inert-integration-google-client';
const root=process.env.FLOW_CODE_ROOT||process.cwd();
const [{pool},Users,Admin,Questions,Auth,Readings,{signAccessToken},{signAdminToken,hashAdminUsername}]=await Promise.all([
  import(pathToFileURL(root+'/dist/config/database.js')),import(pathToFileURL(root+'/dist/models/user.model.js')),
  import(pathToFileURL(root+'/dist/models/admin.model.js')),import(pathToFileURL(root+'/dist/models/adminUserQuestions.model.js')),
  import(pathToFileURL(root+'/dist/services/auth.service.js')),import(pathToFileURL(root+'/dist/models/reading.model.js')),
  import(pathToFileURL(root+'/dist/utils/jwt.js')),import(pathToFileURL(root+'/dist/utils/adminAuth.js')),
]);
const bcrypt=require('bcryptjs');
const {OAuth2Client}=require('google-auth-library');
const ids=[];
let adminId=null;
const prefix=`release-check-${randomUUID()}`;
const password=randomUUID()+'Aa9!';
async function fixture(label) {
  const [row]=await pool.execute('INSERT INTO users (email,nickname,password_hash,username) VALUES (?,?,?,?)',
    [`${prefix}-${label}@example.invalid`,`Fixture ${label}`,await bcrypt.hash(password,4),`${label}_${randomUUID().slice(0,8)}`]);
  ids.push(row.insertId);return row.insertId;
}
async function api(path,token,method='GET',body) {
  const response=await fetch('http://127.0.0.1:5174/api'+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  return {status:response.status,body:await response.json()};
}
function forbiddenFields(value) {
  const text=JSON.stringify(value);
  for(const key of ['password_hash','accessToken','refreshToken','birth_date','system_prompt','SECRET_FIXTURE_ANSWER'])assert.equal(text.includes(key),false,`Unexpected field ${key}`);
}
try {
  const owner=await fixture('owner');
  const other=await fixture('other');
  const legacy=await Users.findById(owner);
  assert.equal(legacy.last_login_at,null);
  const before=Date.now();
  let session=await Auth.login(legacy.email,password);
  const repeated=await Auth.login(legacy.email,password);
  assert.ok(session.refreshToken!==repeated.refreshToken,'Consecutive sessions must remain independent');
  let logged=await Users.findById(owner);
  assert.ok(new Date(logged.last_login_at).getTime()>=before-5);
  assert.ok(new Date(logged.last_login_at).getTime()<=Date.now()+5);
  assert.equal('last_login_at' in session.user,false);
  const marker=new Date('2026-10-20T02:03:04Z');
  await pool.execute('UPDATE users SET last_login_at=? WHERE id=?',[marker,owner]);
  const refreshed=await Auth.refresh(session.refreshToken);
  assert.equal(new Date((await Users.findById(owner)).last_login_at).getTime(),marker.getTime());
  await assert.rejects(Auth.login(legacy.email,randomUUID()));
  assert.equal(new Date((await Users.findById(owner)).last_login_at).getTime(),marker.getTime());
  const verify=OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken=async()=>({getPayload:()=>({sub:`fixture-${prefix}`,email:legacy.email,email_verified:true,name:'Fixture Google user'})});
  try {
    const googleSession=await Auth.signInWithGoogleIdToken('inert-fixture-id-token');
    assert.equal(googleSession.user.id,owner);
    assert.ok(new Date((await Users.findById(owner)).last_login_at).getTime()>marker.getTime());
  } finally {OAuth2Client.prototype.verifyIdToken=verify;}
  const readingIds=[];
  for(let i=0;i<17;i++) {
    readingIds.push(await Readings.create({userId:owner,type:i===0?'reader-reading':'single',question:i===0?'Literal 100%_ creativity question':`Fixture question ${i}`,
      cardIds:[0],orientations:['upright'],answer:'SECRET_FIXTURE_ANSWER',resultData:{interpretation:'SECRET_FIXTURE_ANSWER',followups:i===0?[{question:'Saved fixture followup',answer:'SECRET_FIXTURE_ANSWER',at:'2026-10-27T01:00:00Z'}]:[]}}));
  }
  const latest=await Admin.listUsers({page:1,pageSize:1,keyword:legacy.email,sort:'last-login'});
  assert.equal(latest.total,1);assert.equal(latest.rows[0].id,owner);
  assert.equal(latest.rows[0].latestQuestion.question,'Fixture question 16');
  assert.ok(latest.rows[0].last_login_at);
  forbiddenFields(latest);
  const Fate=await import(pathToFileURL(root+'/dist/models/fate.model.js'));
  const baziId=await Fate.insertBaziResult({userId:owner,birthDate:'2000-01-01',birthTime:null,birthPlace:null,gender:null,
    solarCorrection:false,birthLongitude:null,correctedBirthDate:null,correctedBirthTime:null,solarOffsetMinutes:null,
    baziPillars:null,fiveElementsJson:null,luckTrend:null,keywords:null,analysisText:'SECRET_FIXTURE_ANSWER',question:'Fixture fate question',category:'other'});
  const tarotId=await Fate.insertTarotResult({userId:owner,card1:'Fool',card2:'Magician',card3:'Star',card1En:'Fool',card2En:'Magician',card3En:'Star',
    orient1:'upright',orient2:'upright',orient3:'upright',positions:'Fixture',meaningText:'SECRET_FIXTURE_ANSWER',question:'Fixture fate question',category:'other'});
  const conflictId=await Fate.insertFateConflict({userId:owner,baziId,tarotId,conflictType:'align',conflictLevel:null,
    summaryText:'Fixture',pathStableText:'Fixture',pathAdventureText:'Fixture'});
  await pool.execute('UPDATE fate_conflicts SET created_at=? WHERE id=?',[new Date(Date.now()+1000),conflictId]);
  const withFate=await Admin.listUsers({page:1,pageSize:15,keyword:legacy.email});
  assert.equal(withFate.rows[0].latestQuestion.type,'fate-dual');
  const fateOnly=await Questions.listUserQuestions(owner,{page:1,pageSize:15,type:'fate-dual'});
  assert.equal(fateOnly.total,1);assert.equal(fateOnly.items[0].question,'Fixture fate question');forbiddenFields(fateOnly);
  const history=await Questions.listUserQuestions(owner,{page:99,pageSize:15});
  assert.equal(history.page,2);assert.equal(history.total,18);assert.equal(history.items.length,3);
  const literal=await Questions.listUserQuestions(owner,{page:1,pageSize:15,keyword:'100%_'});
  assert.equal(literal.total,1);
  assert.deepEqual(literal.items[0].followups,[{question:'Saved fixture followup',askedAt:'2026-10-27T01:00:00Z'}]);
  forbiddenFields(literal);
  const empty=await Questions.listUserQuestions(other,{page:1,pageSize:15});
  assert.equal(empty.total,0);assert.equal(empty.page,1);
  const clamped=await Admin.listUsers({page:999,pageSize:15,keyword:prefix});
  assert.equal(clamped.page,1);assert.equal(clamped.rows.length,2);
  // Verify reporting with controlled fixture dates and differences, without
  // disclosing real-user rows or changing their timestamps.
  const now=new Date('2026-10-27T17:00:00Z');
  const statsBeforeUtc=await Admin.getStats(now,'UTC');
  const statsBeforeCn=await Admin.getStats(now,'Asia/Shanghai');
  const datedId=await Readings.create({userId:other,type:'single',question:'Timezone fixture question',cardIds:[0],orientations:['upright'],answer:'Fixture',resultData:{}});
  await pool.execute('UPDATE reading_history SET created_at=? WHERE id=?',[new Date('2026-10-27T12:00:00Z'),datedId]);
  const statsAfterUtc=await Admin.getStats(now,'UTC');
  const statsAfterCn=await Admin.getStats(now,'Asia/Shanghai');
  assert.equal(statsAfterUtc.todayReadings-statsBeforeUtc.todayReadings,1);
  assert.equal(statsAfterCn.todayReadings-statsBeforeCn.todayReadings,0);
  let liveHttp=false;
  if(process.argv.includes('--live-http')) {
    const [row]=await pool.execute('INSERT INTO admin_users (username_hash,password_hash,display_name,is_active) VALUES (?,?,?,1)',
      [hashAdminUsername(prefix),await bcrypt.hash(randomUUID(),4),'Admin verification fixture']);
    adminId=row.insertId;
    const adminToken=signAdminToken({adminId});
    const normalToken=signAccessToken({userId:owner});
    assert.equal((await api(`/admin/users/${owner}/questions`)).status,401);
    assert.equal((await api(`/admin/users/${owner}/questions`,normalToken)).status,401);
    const visible=await api(`/admin/users/${owner}/questions?page=1&pageSize=15`,adminToken);
    assert.equal(visible.status,200);assert.equal(visible.body.data.total,18);forbiddenFields(visible.body);
    const listed=await api(`/admin/users?keyword=${encodeURIComponent(legacy.email)}&sort=last-login`,adminToken);
    assert.equal(listed.status,200);assert.equal(listed.body.data.rows[0].id,owner);forbiddenFields(listed.body);
    assert.equal((await api('/admin/users/1.5/questions',adminToken)).status,400);
    assert.equal((await api(`/admin/users/${owner}/questions?type=password_hash`,adminToken)).status,400);
    assert.equal((await api('/admin/users/9007199254740990/questions',adminToken)).status,404);
    // A real password-login HTTP request records the timestamp; its tokens
    // stay only inside this test process and are never printed or saved.
    await pool.execute('UPDATE users SET last_login_at=? WHERE id=?',[marker,other]);
    const realLogin=await api('/auth/login',null,'POST',{identifier:(await Users.findById(other)).email,password});
    assert.equal(realLogin.status,200);
    assert.ok(new Date((await Users.findById(other)).last_login_at).getTime()>marker.getTime());
    liveHttp=true;
  }
  console.log(JSON.stringify({adminFlows:'passed',passwordLoginTracked:true,googleLoginTracked:true,refreshExcluded:true,failedLoginExcluded:true,
    latestQuestion:true,questionPagination:true,followupsVisible:true,fateQuestionsVisible:true,questionsOnly:true,literalSearch:true,reportingTimeZone:true,liveHttp}));
} finally {
  if(adminId!==null)await pool.execute('DELETE FROM admin_users WHERE id=?',[adminId]);
  for(const id of ids)await Users.deleteUserAndData(id);
  const [left]=await pool.query(`SELECT COUNT(*) AS count FROM users WHERE id IN (${ids.map(()=>'?').join(',')||'NULL'})`,ids);
  assert.equal(Number(left[0].count),0);
  await pool.end();
  console.log(JSON.stringify({fixtureAccountsRemoved:true,fixtureAdminsRemoved:true}));
}
