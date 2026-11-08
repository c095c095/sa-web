import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {app,root,evidence,connect,resetOwnedTest} from './db-common.mjs';
const catalog=JSON.parse(fs.readFileSync(path.join(app,'db/query-catalog.mariadb.json'),'utf8')).rows;
const cases=JSON.parse(fs.readFileSync(path.join(root,'sa-report-kit/sa-deliverables/G/testplan-expected.json'),'utf8')).cases;
const result={started_at:new Date().toISOString(),scope:'Real MariaDB DB/driver compatibility integration only; not browser E2E and not full application acceptance',database:'sa_web_test_p1',historical_replays:[],query_compile:[],constraints:[],concurrency:[]};
let c=await connect('sa_web_test_p1');
const normalize=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d[T ]\d\d:/.test(v)?new Date(v.replace(' ','T').replace(/\+(\d\d)$/,'+$1:00')).toISOString().slice(0,23).replace('T',' '):v;
const attempted=new Set();
try{
  const [[v]]=await c.query('SELECT VERSION() AS version');result.version=v.version;
  // PREPARE resolves identifiers and syntax without executing a mutation.
  for(const q of catalog){try{const positional=q.sql.replace(/(?<!:):[a-z_]+/g,'?');await c.prepare(positional);await c.unprepare(positional);result.query_compile.push({id:q.query_id,status:'PASS'});}catch(e){result.query_compile.push({id:q.query_id,status:'FAIL',error:e.message});}}
  for(const test of cases){
    await resetOwnedTest(c);
    await c.end();c=await connect('sa_web_test_p1');
    const entry={id:test.tc,uc:test.uc,status:'PASS',steps:[]};
    for(const step of test.log){
      const q=catalog.find(x=>x.query_id===step.query_id);attempted.add(q.query_id);
      try{
        const params=Object.fromEntries(Object.entries(step.params).map(([k,v])=>[k,normalize(v)]));
        const [rows]=await c.execute(q.sql,params);
        const count=Array.isArray(rows)?rows.length:rows.affectedRows;
        assert.equal(count,step.row_count,`row count for ${q.query_id}`);
        if(Array.isArray(rows)&&step.rows){
          for(let i=0;i<step.rows.length;i++)for(const [key,expected] of Object.entries(step.rows[i])){
            if(/(?:_at|_date|appointment|arrival|expires|password_hash)$/.test(key))continue;
            const actual=rows[i]?.[key];
            if(expected===null)assert.equal(actual,null);else assert.equal(String(actual),String(expected),`${q.query_id}.${key}`);
          }
        }
        entry.steps.push({query:q.query_id,status:'PASS',actual_row_count:count});
      }catch(e){entry.status='FAIL';entry.steps.push({query:q.query_id,status:'FAIL',error:e.message});break;}
    }
    result.historical_replays.push(entry);
  }
  result.historical_replay_coverage={executed:attempted.size,not_in_historical_replays:catalog.filter(q=>!attempted.has(q.query_id)).map(q=>q.query_id)};
  async function check(name,fn){try{await resetOwnedTest(c);await c.end();c=await connect('sa_web_test_p1');await fn();result.constraints.push({name,status:'PASS'});}catch(e){result.constraints.push({name,status:'FAIL',error:e.message});}}
  async function denied(sql,p=[]){let rejected=false;try{await c.execute(sql,p);}catch(e){if(![1062,1452,4025,1265,3819].includes(e.errno))throw e;rejected=true;}assert(rejected,'Expected the DB to reject invalid data');}
  async function query(id,params,count){const q=catalog.find(q=>q.query_id===id);const [r]=await c.execute(q.sql,params);attempted.add(id);assert.equal(Array.isArray(r)?r.length:r.affectedRows,count,id);return r;}
  await check('Q02 edit/delete alternatives and cascading files',async()=>{
    await query('Q02.7',{defect_id:'DEF202600001',category:'ELECTRICAL',location_pin:'ห้องนอน 2',description:'แก้คำอธิบายสำหรับทดสอบ'},1);
    await query('Q02.8',{file_id:'FIL000001'},1);
    await query('Q02.9',{defect_id:'DEF202600001'},1);
    const [[r]]=await c.query("SELECT COUNT(*) n FROM file WHERE defect_id='DEF202600001'");assert.equal(r.n,0);
  });
  await check('Q06 new defect after recheck and return to OPEN',async()=>{
    const rows=await query('Q06.4',{round_id:'RND0002',category:'WALL',location_pin:'ห้องนอนทดสอบ',description:'จุดใหม่ในการทดสอบ',inspector_id:'EMP0004'},1);
    await query('Q06.5',{defect_id:rows[0].defect_id,file_url:'http://localhost/test-only-before.png'},1);
    await c.query("UPDATE inspection_round SET recheck_result='DEFECT_FOUND' WHERE round_id='RND0002'");
    await query('Q06.6',{round_id:'RND0002'},1);
    const [[r]]=await c.query("SELECT status,recheck_result FROM inspection_round WHERE round_id='RND0002'");assert.equal(r.status,'OPEN');assert.equal(r.recheck_result,null);
  });
  await check('Q17 evidence read and latest report ordering',async()=>{await query('Q17.3',{defect_id:'DEF202600013'},2);const rows=await query('Q17.4',{round_id:'RND0012'},1);assert.equal(rows[0].report_id,'RPT00003');});
  await check('Foreign key actually enforced',()=>denied("UPDATE property_unit SET registered_by='EMP9999' WHERE unit_id='H0001'"));
  await check('Unique project and house',()=>denied("INSERT INTO property_unit(project_name,house_no,registered_by) VALUES('ร่มไม้ทาวน์ บางเขน','88/1','EMP0001')"));
  await check('One active round per unit and type',()=>denied("INSERT INTO inspection_round(unit_id,round_type,inspector_id) VALUES('H0001','QC_INTERNAL','EMP0003')"));
  await check('Multiple closed rounds allowed',async()=>{await c.execute("INSERT INTO inspection_round(unit_id,round_type,inspector_id,is_single_certify,recheck_result,status,closed_at) VALUES('H0001','QC_INTERNAL','EMP0003',1,'NO_DEFECT','CLOSED',NOW()),('H0001','QC_INTERNAL','EMP0003',1,'NO_DEFECT','CLOSED',NOW())");});
  await check('One signature per home',()=>denied("INSERT INTO file(unit_id,file_url,file_usage) VALUES('H0008','http://localhost/test-signature.png','SIGNATURE')"));
  await check('Other files may share a defect',async()=>{await c.execute("INSERT INTO file(defect_id,file_url,file_usage) VALUES('DEF202600001','http://localhost/test-1.png','BEFORE_FIX'),('DEF202600001','http://localhost/test-2.png','BEFORE_FIX')");});
  await check('File exactly one owner',()=>denied("INSERT INTO file(unit_id,defect_id,file_url,file_usage) VALUES('H0001','DEF202600001','http://localhost/test.png','BEFORE_FIX')"));
  await check('File usage must match owner',()=>denied("INSERT INTO file(unit_id,file_url,file_usage) VALUES('H0001','http://localhost/test.png','AFTER_FIX')"));
  await check('Technician needs a craft',()=>denied("UPDATE employee SET craft_category=NULL WHERE employee_id='EMP0005'"));
  await check('Co-inspector must differ',()=>denied("UPDATE inspection_round SET co_inspector_id='EMP0003' WHERE round_id='RND0001'"));
  await check('Closed QC needs XOR certification',()=>denied("UPDATE inspection_round SET status='CLOSED',closed_at=NOW(),recheck_result='NO_DEFECT',co_inspector_id='EMP0004',is_single_certify=1 WHERE round_id='RND0001'"));
  await check('Closed QC rejects NULL recheck result (AM-06)',()=>denied("UPDATE inspection_round SET status='CLOSED',closed_at=NOW(),recheck_result=NULL,is_single_certify=1 WHERE round_id='RND0001'"));
  await check('Completed request rejects NULL acceptance (AM-06)',()=>denied("UPDATE inspection_request SET status='COMPLETED',arrival=NOW(),accept_result=NULL WHERE request_id='REQ000001'"));
  await check('Handover timestamp matches state',()=>denied("UPDATE property_unit SET handed_over_at=NOW() WHERE unit_id='H0001'"));
  await check('Invalid enum rejected in strict mode',()=>denied("UPDATE defect SET status='MADE_UP' WHERE defect_id='DEF202600001'"));
  await check('Token is case-sensitive',async()=>{const [[{n}]]=await c.query("SELECT COUNT(*) n FROM access_link WHERE token=UPPER('c4998ab63c6659269b380ef9a5a5c1cf89235c677e673885385a26e2d3535542')");assert.equal(n,0);});
  await check('Parameterized injection is data',async()=>{const [rows]=await c.execute("SELECT employee_id FROM employee WHERE employee_id=?",["EMP0003' OR 1=1 --"]);assert.equal(rows.length,0);});
  await check('Unicode Thai round trip',async()=>{const text='ห้องน้ำ ชั้น ๒ รอยร้าวและน้ำซึม';await c.execute('UPDATE defect SET description=? WHERE defect_id=?',[text,'DEF202600001']);const [[r]]=await c.execute('SELECT description FROM defect WHERE defect_id=?',['DEF202600001']);assert.equal(r.description,text);});
  await check('Finish marker persists and blocks post-finish edits (AM-01)',async()=>{await c.execute("UPDATE inspection_round SET inspection_finished_at=NOW() WHERE round_id='RND0001'");const [r]=await c.execute("UPDATE defect d JOIN inspection_round r ON r.round_id=d.round_id SET d.description='should not change' WHERE d.defect_id='DEF202600001' AND d.status='WAITING_ASSIGN' AND r.inspection_finished_at IS NULL");assert.equal(r.affectedRows,0);});
  await check('Craft guard blocks direct cross-category claim (AM-02)',async()=>{const [r]=await c.execute("UPDATE defect d JOIN employee e ON e.employee_id=? SET d.technician_id=e.employee_id,d.status='ASSIGNED',d.assigned_date=NOW() WHERE d.defect_id=? AND d.status='WAITING_ASSIGN' AND e.is_active=1 AND e.role IN ('TECHNICIAN','HEAD_TECHNICIAN') AND (e.craft_category IS NULL OR e.craft_category=d.category)",['EMP0006','DEF202600001']);assert.equal(r.affectedRows,0);});
  await check('Customer link cannot address another home defect (AM-03)',async()=>{const sql="SELECT d.defect_id FROM access_link l JOIN inspection_round r ON r.unit_id=l.unit_id JOIN defect d ON d.round_id=r.round_id WHERE l.token=? AND l.expires_at>NOW() AND d.defect_id=?";const [other]=await c.execute(sql,['c4998ab63c6659269b380ef9a5a5c1cf89235c677e673885385a26e2d3535542','DEF202600013']);assert.equal(other.length,0);const [own]=await c.execute(sql,['5427c59eeda33f103797695e2905c4d9359cddcbca325d6af33a08997d35d377','DEF202600013']);assert.equal(own.length,1);});
  await check('Sequence stops instead of truncating ID width',async()=>{const a=await connect('sa_web_test_p1',true);try{await a.query('ALTER SEQUENCE seq_unit RESTART WITH 9999');const [[first]]=await c.query('SELECT NEXT VALUE FOR seq_unit AS n');assert.equal(Number(first.n),9999);let exhausted=false;try{await c.query('SELECT NEXT VALUE FOR seq_unit AS n');}catch(e){exhausted=e.errno===4084;}assert(exhausted,'Sequence must reject beyond 9999');}finally{await a.end();}});
  await resetOwnedTest(c);
  const workers=await Promise.all([connect('sa_web_test_p1'),connect('sa_web_test_p1')]);
  try{
    const claims=await Promise.all(workers.map((w,i)=>w.execute("UPDATE defect SET technician_id=?,status='ASSIGNED',assigned_date=NOW() WHERE defect_id='DEF202600001' AND status='WAITING_ASSIGN'",[i?'EMP0008':'EMP0005'])));
    assert.equal(claims.reduce((n,[r])=>n+r.affectedRows,0),1);result.concurrency.push({name:'Two simultaneous claims, one succeeds',status:'PASS'});
    const ids=await Promise.all(Array.from({length:30},(_,i)=>workers[i%2].query('SELECT NEXT VALUE FOR seq_employee AS n')));
    assert.equal(new Set(ids.map(([[r]])=>String(r.n))).size,30);result.concurrency.push({name:'30 concurrent sequence values remain unique',status:'PASS'});
  }finally{await Promise.all(workers.map(w=>w.end()));}
  await resetOwnedTest(c);
}catch(e){result.fatal=e.message;}
finally{await c.end();}
result.finished_at=new Date().toISOString();result.query_runtime_coverage={executed:attempted.size,total:77,not_executed:catalog.filter(q=>!attempted.has(q.query_id)).map(q=>q.query_id)};
result.passed=[...result.query_compile,...result.historical_replays,...result.constraints,...result.concurrency].filter(x=>x.status==='PASS').length;
result.failed=[...result.query_compile,...result.historical_replays,...result.constraints,...result.concurrency].filter(x=>x.status==='FAIL').length;
result.status=result.failed||result.fatal?'FAIL':'PASS';
fs.writeFileSync(path.join(evidence,'db-compatibility.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,compiled:result.query_compile.length,replays:result.historical_replays.length,constraints:result.constraints.length,concurrency:result.concurrency.length,passed:result.passed,failed:result.failed,coverage:result.query_runtime_coverage,failures:[...result.historical_replays,...result.constraints].filter(x=>x.status==='FAIL'),fatal:result.fatal},null,2));
if(result.status==='FAIL')process.exitCode=1;
