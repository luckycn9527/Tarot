// Real MySQL and HTTP integration using isolated, randomly prefixed tables.
// Never writes the serving site's configuration or creates public test assets.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
if(!process.argv.includes('--allow-isolated-database-tests'))throw new Error('Requires --allow-isolated-database-tests and a database backup');
const require=createRequire(process.cwd()+'/package.json');
require('dotenv').config();
const root=process.env.FLOW_CODE_ROOT||process.cwd();
const [{pool},{signAdminToken},{signAccessToken},History,Admin]=await Promise.all([
  import(pathToFileURL(root+'/dist/config/database.js')),import(pathToFileURL(root+'/dist/utils/adminAuth.js')),
  import(pathToFileURL(root+'/dist/utils/jwt.js')),import(pathToFileURL(root+'/dist/models/configHistory.model.js')),
  import(pathToFileURL(root+'/dist/models/admin.model.js')),
]);
const prefix=`cfg_hist_test_${randomBytes(6).toString('hex')}_`;
assert.match(prefix,/^cfg_hist_test_[a-f0-9]{12}_$/);
const tables=['admin_users','card_backs','tarot_cards_config','reader_prompts_config','featured_readers','reference_tarot_readers','user_card_backs','admin_config_versions','admin_config_heads'];
const realQuery=pool.query.bind(pool),realExecute=pool.execute.bind(pool),realGet=pool.getConnection.bind(pool);
const names=tables.map(name=>prefix+name);
const pattern=new RegExp(`\\b(${tables.join('|')})\\b`,'g');
const rewrite=sql=>typeof sql==='string'?sql.replace(pattern,name=>prefix+name):{...sql,sql:sql.sql.replace(pattern,name=>prefix+name)};
const originalMethods={query:pool.query,execute:pool.execute,getConnection:pool.getConnection};
const created=[];
let server=null;
function wrapConnection(connection) {
  return new Proxy(connection,{get(target,key){
    if(key==='query'||key==='execute')return (sql,...args)=>target[key](rewrite(sql),...args);
    const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }});
}
const scopes=['card-backs','cards','readers-prompts','featured-readers'];
try {
  for(const table of tables) {
    const fixture=prefix+table;
    assert.ok(names.includes(fixture));
    await realQuery(`CREATE TABLE \`${fixture}\` LIKE \`${table}\``);created.push(fixture);
  }
  // A copied table must never retain a foreign key into production data.
  const [foreignKeys]=await realQuery(`SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${created.map(()=>'?').join(',')}) AND REFERENCED_TABLE_NAME IS NOT NULL`,created);
  assert.equal(foreignKeys.length,0,'Fixture tables must not reference serving tables');
  for(const scope of scopes)await realExecute(`INSERT INTO \`${prefix}admin_config_heads\` (scope) VALUES (?)`,[scope]);
  const [firstAdmin]=await realExecute(`INSERT INTO \`${prefix}admin_users\` (username_hash,password_hash,display_name,is_active) VALUES (?, ?, ?, 1)`,['a'.repeat(64),'inert-fixture-password-hash','Config fixture operator']);
  const [secondAdmin]=await realExecute(`INSERT INTO \`${prefix}admin_users\` (username_hash,password_hash,display_name,is_active) VALUES (?, ?, ?, 1)`,['b'.repeat(64),'inert-fixture-password-hash','Second fixture operator']);
  const adminId=firstAdmin.insertId,otherAdmin=secondAdmin.insertId;
  pool.query=(sql,...args)=>realQuery(rewrite(sql),...args);
  pool.execute=(sql,...args)=>realExecute(rewrite(sql),...args);
  pool.getConnection=async()=>wrapConnection(await realGet());
  await History.initializeBaselines();
  const initial=await History.listConfigHistory({page:1,pageSize:20});
  assert.equal(initial.total,4);assert.ok(initial.items.every(row=>row.action==='baseline'&&row.revision===0));
  const baseline=Object.fromEntries(initial.items.map(row=>[row.scope,row.id]));
  const express=require('express');
  const app=express();app.use(express.json({limit:'1mb'}));
  app.use('/api/admin',(await import(pathToFileURL(root+'/dist/routes/admin.routes.js'))).default);
  app.use('/api/reference',(await import(pathToFileURL(root+'/dist/routes/reference.routes.js'))).default);
  app.use((await import(pathToFileURL(root+'/dist/middleware/errorHandler.js'))).errorHandler);
  server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const token=signAdminToken({adminId}),otherToken=signAdminToken({adminId:otherAdmin});
  async function api(path,method='GET',body,access=token) {
    const response=await fetch(origin+'/api'+path,{method,headers:{'content-type':'application/json',...(access?{authorization:`Bearer ${access}`}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  const match=version=>({expectedRevision:version.revision,expectedHash:version.hash});
  async function read(scope) {
    const response=await api('/admin/config/'+scope);assert.equal(response.status,200);return response.body;
  }
  async function write(scope,items,version,access=token) {
    return api('/admin/config/'+scope,'PUT',{items,...match(version),reason:'Fixture confirmed change'},access);
  }
  async function restore(id) {
    const preview=await api(`/admin/config-history/${id}/rollback-preview`);assert.equal(preview.status,200);
    return api(`/admin/config-history/${id}/rollback`,'POST',{...match(preview.body.data.configVersion),reason:'Fixture restore confirmed'});
  }
  assert.equal((await api('/admin/config-history','GET',undefined,null)).status,401);
  assert.equal((await api('/admin/config-history','GET',undefined,signAccessToken({userId:991}))).status,401);
  assert.equal((await api('/admin/config-history?scope=users')).status,400);
  assert.equal((await api('/admin/config-history/1.5')).status,400);
  assert.equal((await api('/admin/config-history/9007199254740990')).status,404);
  const card={id:0,name:'Fixture Fool',nameEn:'Fixture Fool',uprightKeywords:'Start',reversedKeywords:'Pause',yesNoTendency:'neutral',isActive:true};
  assert.equal((await api('/admin/config/cards','PUT',{items:[card]})).status,400);
  let cards=await read('cards');assert.equal(cards.data.length,78);
  const v0=cards.configVersion;
  const first=await write('cards',[card],v0);assert.equal(first.status,200);assert.equal(first.body.data.configVersion.revision,1);
  const cardVersion=first.body.data.versionId;
  let publicCards=await api('/reference/core','GET',undefined,null);
  assert.equal(publicCards.body.data.cards.length,78);assert.equal(publicCards.body.data.cards[0].name,'Fixture Fool');
  assert.ok(publicCards.headers.get('cache-control').includes('max-age=0'));
  cards=await read('cards');
  const noChange=await write('cards',[card],cards.configVersion);assert.equal(noChange.status,200);assert.equal(noChange.body.data.changed,false);
  assert.equal((await History.listConfigHistory({scope:'cards',page:1,pageSize:20})).total,2);
  assert.equal((await write('cards',[{...card,name:'Stale client'}],v0)).status,409);
  const second=await write('cards',[{...card,name:'Second fixture card'}],cards.configVersion);assert.equal(second.status,200);
  const originalRecord=await History.configVersionDetail(cardVersion);
  const reset=await restore(baseline.cards);assert.equal(reset.status,200);assert.equal(reset.body.data.configVersion.revision,3);
  publicCards=await api('/reference/core','GET',undefined,null);
  assert.equal(publicCards.body.data.cards.length,78);assert.notEqual(publicCards.body.data.cards[0].name,'Fixture Fool');
  assert.deepEqual(await History.configVersionDetail(cardVersion),originalRecord,'Rollback must preserve previous records');
  const redo=await restore(cardVersion);assert.equal(redo.status,200);
  cards=await read('cards');
  const concurrent=await Promise.all([
    write('cards',[{...card,name:'Concurrent A'}],cards.configVersion),
    write('cards',[{...card,name:'Concurrent B'}],cards.configVersion,otherToken),
  ]);
  assert.deepEqual(concurrent.map(row=>row.status).sort(),[200,409]);
  cards=await read('cards');assert.equal(cards.configVersion.revision,5);
  const beforeFailure=(await History.listConfigHistory({scope:'cards',page:1,pageSize:20})).total;
  await assert.rejects(History.changeConfig('cards',adminId,match(cards.configVersion),'save',async connection=>{
    await Admin.upsertTarotCardsConfig([{...card,id:1,name:'Partial write'}],connection);
    throw new Error('Fixture transaction failure');
  }),/Fixture transaction failure/);
  assert.equal((await History.listConfigHistory({scope:'cards',page:1,pageSize:20})).total,beforeFailure);
  assert.equal((await pool.query('SELECT id FROM tarot_cards_config WHERE id=1'))[0].length,0);
  const revisionBefore=cards.configVersion.revision;
  await pool.execute('UPDATE tarot_cards_config SET name=? WHERE id=0',['Out-of-band fixture change']);
  assert.equal((await write('cards',[card],cards.configVersion)).status,409,'Hash also protects untracked changes');
  cards=await read('cards');assert.equal(cards.configVersion.revision,revisionBefore);
  assert.equal((await write('cards',[card],cards.configVersion)).status,200);
  let readers=await read('readers-prompts');
  const prompt={readerCode:'qinghe',displayName:'Fixture reader',avatarUrl:null,emoji:null,accessLevel:'free',systemPrompt:'Fixture system prompt\n'+'Long text. '.repeat(500),greeting:'Fixture greeting'};
  const savedPrompt=await write('readers-prompts',[prompt],readers.configVersion);assert.equal(savedPrompt.status,200);
  const promptDetails=(await api(`/admin/config-history/${savedPrompt.body.data.versionId}`)).body.data;
  assert.equal(promptDetails.changes[0].fields.find(field=>field.field==='systemPrompt').after,prompt.systemPrompt);
  let featured=await read('featured-readers');
  const savedFeatured=await write('featured-readers',[{readerCode:'qinghe',isActive:true,sortOrder:1}],featured.configVersion);assert.equal(savedFeatured.status,200);
  let backs=await read('card-backs');
  const back={code:'fixture_back',name:'Fixture paid back',description:null,assetUrl:'/uploads/fixture-back.png',isActive:true,accessType:'paid',price:9.99,sortOrder:0};
  const savedBack=await write('card-backs',[back],backs.configVersion);assert.equal(savedBack.status,200);
  const backVersion=savedBack.body.data.versionId;
  backs=await read('card-backs');const backId=backs.data[0].id;
  await pool.execute('INSERT INTO user_card_backs (user_id,card_back_id) VALUES (?,?)',[991,backId]);
  const renamed=await write('card-backs',[{...back,id:backId,name:'Updated back'}],backs.configVersion);assert.equal(renamed.status,200);
  assert.equal((await restore(backVersion)).status,200);
  backs=await read('card-backs');assert.equal(backs.data[0].id,backId);assert.equal(Number(backs.data[0].price),9.99);
  const blockedPreview=await api(`/admin/config-history/${baseline['card-backs']}/rollback-preview`);
  assert.equal(blockedPreview.body.data.blockers.length,1);
  assert.equal((await restore(baseline['card-backs'])).status,409);
  assert.equal((await api(`/admin/config/card-backs/${backId}`,'DELETE',match(backs.configVersion))).status,409);
  assert.equal((await pool.query('SELECT * FROM user_card_backs WHERE user_id=991'))[0].length,1);
  await pool.execute('DELETE FROM user_card_backs WHERE user_id=991');
  assert.equal((await api(`/admin/config/card-backs/${backId}`,'DELETE',match(backs.configVersion))).status,200);
  assert.equal((await read('card-backs')).data.length,0);
  assert.equal((await restore(backVersion)).status,200);
  assert.equal((await read('card-backs')).data[0].id,backId,'Restoring preserves card-back identifiers');
  assert.equal((await restore(baseline['readers-prompts'])).status,200);
  assert.equal((await pool.query('SELECT id FROM reader_prompts_config'))[0].length,0);
  assert.equal((await read('featured-readers')).data.find(row=>row.readerCode==='qinghe').isActive,true,'Rollback must remain within its category');
  const stalePreview=await api(`/admin/config-history/${cardVersion}/rollback-preview`);
  cards=await read('cards');assert.equal((await write('cards',[{...card,name:'After preview'}],cards.configVersion)).status,200);
  assert.equal((await api(`/admin/config-history/${cardVersion}/rollback`,'POST',{...match(stalePreview.body.data.configVersion),reason:'Fixture stale confirmation'})).status,409);
  const listed=await api('/admin/config-history?scope=cards&page=999&pageSize=2');assert.equal(listed.status,200);
  assert.ok(listed.body.data.page<=listed.body.data.totalPages);
  assert.equal(JSON.stringify(listed.body).includes('before_snapshot'),false);
  assert.equal(JSON.stringify(listed.body).includes(prompt.systemPrompt),false,'List metadata must not load full prompts');
  console.log(JSON.stringify({configHistoryFlows:'passed',isolatedTables:true,baseline:true,fourCategories:true,noOpNoRecord:true,
    concurrentWriteProtection:true,untrackedWriteProtection:true,atomicFailure:true,rollbackCreatesRecord:true,oldRecordsImmutable:true,
    rollbackScopeIsolation:true,ownedCardBacksProtected:true,cardBackIdsPreserved:true,referenceCacheRefreshed:true,
    defaultCardsRetained:true,stalePreviewRejected:true,guestAndUserDenied:true,realConfigurationWrites:0}));
} finally {
  if(server)await new Promise(resolve=>server.close(resolve));
  Object.assign(pool,originalMethods);
  for(const name of created.reverse()) {
    assert.ok(name.startsWith(prefix)&&names.includes(name));
    await realQuery(`DROP TABLE IF EXISTS \`${name}\``);
  }
  const [remaining]=await realQuery(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${names.map(()=>'?').join(',')})`,names);
  assert.equal(remaining.length,0);
  await pool.end();
  console.log(JSON.stringify({fixtureTablesRemoved:true}));
}
