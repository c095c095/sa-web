import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {evidence} from './db-common.mjs';
const screenshots=path.join(evidence,'screenshots');fs.mkdirSync(screenshots,{recursive:true});
const result={started_at:new Date().toISOString(),scope:'P1 read-only pilot browser tests, not full application E2E',routes:[],interaction:[],console_errors:[],accessibility:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',error=>result.console_errors.push(error.message));
  for(const width of [320,375,390,768,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:900});
    for(const route of ['technician','report','status']){
      const response=await page.goto(`http://127.0.0.1:3000/pilot/${route}`,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,font:getComputedStyle(document.body).fontFamily,language:document.documentElement.lang}));
      assert.equal(response.status(),200);assert(bounds.scroll<=width,`${route} overflows at ${width}`);assert.equal(bounds.language,'th');assert(bounds.font.includes('IBM Plex Sans Thai'));
      await page.screenshot({path:path.join(screenshots,`${route}-${width}.png`),fullPage:true});
      result.routes.push({route,width,status:'PASS',...bounds});
      if([390,1280].includes(width)){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.accessibility.push({route,width,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});}
    }
  }
  async function test(name,fn){try{await page.setViewportSize({width:1280,height:900});await fn();result.interaction.push({name,status:'PASS'});}catch(e){result.interaction.push({name,status:'FAIL',error:e.message});}}
  await test('Queue filter updates URL and survives reload',async()=>{await page.goto('http://127.0.0.1:3000/pilot/technician');await page.getByLabel('ประเภทงานช่าง',{exact:true}).selectOption('ELECTRICAL');await page.reload();assert.equal(await page.getByLabel('ประเภทงานช่าง',{exact:true}).inputValue(),'ELECTRICAL');assert((await page.locator('body').innerText()).includes('รอช่างรับ 1 รายการ'));});
  await test('Queue empty search, then clear filters',async()=>{await page.getByLabel('ค้นหางาน',{exact:true}).fill('not-a-demo-home');await page.getByRole('heading',{name:'ไม่มีงานในรายการนี้'}).waitFor();await page.getByRole('button',{name:'ล้างตัวกรอง'}).click();await page.getByRole('button',{name:'ทบทวนงานที่เลือก (0)'}).waitFor();});
  await test('Selection reviews only and never claims a job',async()=>{await page.getByLabel('เลือกงาน DEF202600001',{exact:true}).first().check();await page.getByRole('button',{name:'ทบทวนงานที่เลือก (1)'}).click();assert((await page.getByRole('status').innerText()).includes('ยังไม่ได้รับงานจริง'));});
  await test('Explicit loading, empty and error states render',async()=>{for(const [state,text] of [['loading','กำลังโหลดรายการงาน'],['empty','ไม่มีงานในรายการนี้'],['error','โหลดรายการงานไม่ได้']]){await page.goto(`http://127.0.0.1:3000/pilot/technician?state=${state}`);assert((await page.locator('body').innerText()).includes(text));await page.screenshot({path:path.join(screenshots,`technician-state-${state}.png`),fullPage:true});}});
  await test('Search focus ring surrounds group only, for pointer and keyboard',async()=>{await page.goto('http://127.0.0.1:3000/pilot/technician');const search=page.locator('#queue-search');for(const method of ['click','focus']){await search[method]();const styles=await search.evaluate(e=>{const inner=getComputedStyle(e),group=getComputedStyle(e.parentElement);return {innerStyle:inner.outlineStyle,innerWidth:inner.outlineWidth,groupStyle:group.outlineStyle,groupWidth:group.outlineWidth,background:group.backgroundColor};});assert.equal(styles.innerStyle,'none');assert.equal(styles.innerWidth,'0px');assert.equal(styles.groupStyle,'solid');assert.equal(styles.groupWidth,'2px');assert.equal(styles.background,'rgb(255, 255, 255)');}await page.screenshot({path:path.join(screenshots,'search-focus-after.png')});});
  await test('Reporter choices are exclusive and support arrow keys; fields are white',async()=>{await page.goto('http://127.0.0.1:3000/pilot/report');const customer=page.getByRole('radio',{name:'ลูกค้า',exact:true});const external=page.getByRole('radio',{name:'บริษัทตรวจนอก',exact:true});assert(await customer.isChecked());await page.getByText('บริษัทตรวจนอก',{exact:true}).click();assert(await external.isChecked());assert(!(await customer.isChecked()));await external.focus();await page.keyboard.press('ArrowLeft');assert(await customer.isChecked());for(const id of ['location','description','photos'])assert.equal(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');await page.screenshot({path:path.join(screenshots,'reporter-keyboard-focus.png'),fullPage:true});});
  await test('Form validation focuses first invalid field',async()=>{await page.goto('http://127.0.0.1:3000/pilot/report');await page.getByRole('button',{name:'ทบทวนรายการ',exact:true}).click();assert.equal(await page.locator(':focus').getAttribute('id'),'location');assert.equal(await page.locator('#location').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('#photos').getAttribute('aria-invalid'),'true');await page.screenshot({path:path.join(screenshots,'report-errors.png'),fullPage:true});});
  await test('Valid local photo and optional description produce preview, no POST',async()=>{const posts=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});await page.getByText('บริษัทตรวจนอก',{exact:true}).click();await page.locator('#location').fill('ห้องน้ำชั้น 2');await page.locator('#photos').setInputFiles({name:'validation-test-only.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3b8AAAAASUVORK5CYII=','base64')});await page.getByRole('button',{name:'ทบทวนรายการ',exact:true}).click();assert((await page.getByRole('status').innerText()).includes('ยังไม่ได้บันทึกจุด'));assert.equal(posts.length,0);});
  await test('Oversized image rejected locally',async()=>{await page.locator('#photos').setInputFiles({name:'too-large-test.png',mimeType:'image/png',buffer:Buffer.alloc(6*1024*1024)});await page.getByRole('button',{name:'ทบทวนรายการ',exact:true}).click();assert.equal(await page.locator('#photos').getAttribute('aria-invalid'),'true');});
  await test('Only FIXED defects selectable on SCR-17',async()=>{await page.goto('http://127.0.0.1:3000/pilot/status');const boxes=page.locator('table input[type=checkbox]');assert.equal(await boxes.count(),5);assert.equal(await page.locator('table input[type=checkbox]:enabled').count(),1);await page.getByLabel('เลือกจุดที่ไม่ผ่าน DEF202600013',{exact:true}).first().check();await page.getByRole('button',{name:'ทบทวนผลการตรวจ'}).click();assert((await page.getByRole('status').innerText()).includes('ยังไม่ได้บันทึกผล'));});
  await test('Keyboard skip link and visible focus',async()=>{await page.goto('http://127.0.0.1:3000/pilot/technician');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('href'),'#main-content');const outline=await page.locator(':focus').evaluate(e=>getComputedStyle(e).outlineStyle);assert.notEqual(outline,'none');});
  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});const staticPage=await noJs.newPage();await staticPage.goto('http://127.0.0.1:3000/pilot/technician');assert((await staticPage.locator('body').innerText()).includes('งานที่รอช่างรับ'));result.interaction.push({name:'SSR content visible without JavaScript',status:'PASS'});await noJs.close();
  await context.close();
}catch(e){result.fatal=e.message;}finally{await browser.close();}
result.finished_at=new Date().toISOString();result.violations=result.accessibility.reduce((n,v)=>n+v.violations.length,0);
result.failed=result.interaction.filter(x=>x.status==='FAIL').length;
result.status=result.fatal||result.failed||result.violations||result.console_errors.length?'FAIL':'PASS';
fs.writeFileSync(path.join(evidence,'pilot-browser.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,viewports:result.routes.length,interaction:result.interaction,accessibility_violations:result.violations,console_errors:result.console_errors,fatal:result.fatal},null,2));if(result.status==='FAIL')process.exitCode=1;
