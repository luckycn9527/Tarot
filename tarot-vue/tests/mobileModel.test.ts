import test from 'node:test'
import assert from 'node:assert/strict'
import { mobileDeck, validDraft, validPendingTask, questionValid, followupValid, savedMessages, savedSummary, savedFollowups } from '../src/mobile/mobileModel'
import { offlineCards, getOfflineCardImageUrl } from '../src/mobile/data/offlineCards'
import type { MobileDraft, PendingMobileTask } from '../src/mobile/types'
import type { ReadingHistoryEntry } from '../src/stores/readingHistory'

const owner = 71
function draft(): MobileDraft { return { schema:1,owner,question:'我可以如何规划下一步？',count:1,readerId:'qinghe',carried:null,deck:[{id:0,isReversed:false}],selected:[0],revealed:[0],phase:'reveal',savedAt:Date.now() } }
function pending(): PendingMobileTask { return { schema:1,owner,requestId:'a319d6e2-c61b-46c7-9d75-59958950d448',kind:'reading',createdAt:Date.now(),payload:{readerId:'qinghe',spreadType:'single',question:'我可以如何规划下一步？',category:'其他',cardIds:[0],orientations:['upright'],locale:'zh-CN'} } }
const history = (resultData: unknown,type: ReadingHistoryEntry['type']='reader-reading') => ({id:1,type,question:'测试问题',cardIds:[0],orientations:['upright'],answer:'是',resultData,readerId:'qinghe',spreadType:'single',createdAt:new Date().toISOString()}) as ReadingHistoryEntry

test('mobile deck contains each enabled card once, preserves legal zero and rejects invalid IDs',()=>{
  const ids=offlineCards.map(row=>row.id),deck=mobileDeck([...ids,0,-1,78],()=>.37)
  assert.equal(deck.length,78);assert.equal(new Set(deck.map(row=>row.id)).size,78);assert.ok(deck.some(row=>row.id===0))
  assert.ok(deck.every(row=>typeof row.isReversed==='boolean'));assert.equal(getOfflineCardImageUrl('The Star','/preview/'),'/preview/mobile/cards/The_Star.webp')
})
test('mobile persisted drafts enforce account ownership, unique selections and expiry',()=>{
  assert.ok(validDraft(draft(),owner));assert.equal(validDraft(draft(),owner+1),false)
  assert.equal(validDraft({...draft(),selected:[0,0]},owner),false)
  assert.equal(validDraft({...draft(),revealed:[3]},owner),false)
  assert.equal(validDraft({...draft(),savedAt:Date.now()-8*86400000},owner),false)
})
test('carried card and completed reading restore without creating a fresh reading',()=>{
  const carried={...draft(),carried:{id:17,isReversed:true},deck:[],selected:[],revealed:[17]}
  assert.ok(validDraft(carried,owner));assert.equal(validDraft({...carried,count:3},owner),false)
  assert.ok(validDraft({...carried,phase:'result',readingId:88},owner))
  assert.equal(validDraft({...carried,phase:'result'},owner),false)
  assert.equal(validDraft({...carried,owner:null,phase:'result',readingId:88},null),false)
})
test('pending request restore validates UUID, original payload, card count and owner',()=>{
  const request=pending();assert.ok(validPendingTask(request,owner));assert.equal(validPendingTask(request,null),false)
  assert.equal(validPendingTask(request,owner+1),false);assert.equal(validPendingTask({...request,requestId:'not-a-uuid'},owner),false)
  assert.equal(validPendingTask({...request,payload:{...request.payload,cardIds:[0,0,1],spreadType:'problem'}},owner),false)
  assert.equal(validPendingTask({...request,payload:{...request.payload,cardIds:null}},owner),false)
  assert.ok(validPendingTask({...request,kind:'followup',payload:{readingId:88,question:'之后呢？',locale:'zh-CN'}},owner))
})
test('question and follow-up character limits reject blank and oversized input',()=>{
  assert.equal(questionValid('   '),false);assert.equal(questionValid('1234'),false);assert.ok(questionValid(' 12345 '));assert.equal(questionValid('x'.repeat(201)),false)
  assert.equal(followupValid('？'),false);assert.ok(followupValid(' 下一步？ '));assert.equal(followupValid('x'.repeat(201)),false)
})
test('old single/three-card/daily records retain full saved interpretation',()=>{
  const entry=history({interpretation:'完整牌面解读',advice:'行动建议',conclusion:'原结论',cardReadings:[{summary:'第一张牌解释'}]},'three-card')
  assert.equal(savedSummary(entry),'原结论');assert.deepEqual(savedMessages(entry).map(row=>row.content),['完整牌面解读','行动建议','原结论','第一张牌解释'])
  assert.equal(savedMessages(history({sections:{intro:'开场',overall:'今日整体'}} ,'daily-fortune')).length,2)
})
test('reader history parses old JSON text safely and rejects malformed followups',()=>{
  const entry=history(JSON.stringify({summary:'保存的摘要',messages:[{type:'greeting',content:'你好'},{type:'reading',content:'完整解读'}],followups:[{question:'接下来呢？',answer:'保存的回答'},null,{question:'wrong'}]}))
  assert.equal(savedSummary(entry),'保存的摘要');assert.equal(savedMessages(entry).length,1);assert.equal(savedFollowups(entry).length,1)
  assert.deepEqual(savedMessages(history('{malformed')),[])
})
