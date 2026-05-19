/**
 * AVA Report Generator — report.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained PDF generation module. Call:
 *
 *   await generateAVAReport(aData, fMeta)
 *
 *   aData — full API response { score, audit_id, severity, agent1–5 }
 *   fMeta — form metadata  { title, industry, city, country, delivery, budget }
 *
 * Requires jsPDF loaded globally (window.jspdf.jsPDF).
 * Place report-bg.jpg at the root of the same deployment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── AVA LOGO (white paths, transparent bg) — base64 SVG ─────────────────────
const AVA_LOGO_B64 = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMiIgZGF0YS1uYW1lPSJMYXllciAyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMTAzLjc4IDM1My40OSI+CiAgPGRlZnM+CiAgICA8c3R5bGU+CiAgICAgIC5jbHMtMSB7CiAgICAgICAgZmlsbDogI2ZmZjsKICAgICAgfQogICAgPC9zdHlsZT4KICA8L2RlZnM+CiAgPGcgaWQ9IkxheWVyXzEtMiIgZGF0YS1uYW1lPSJMYXllciAxIj4KICAgIDxnPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0yMzcuMzgsMzEuNzVMNTAuNDMsMzUzLjQ5bC01MC40My0uMDVMMjA4Ljc0LDBoNTcuMjNsMjEwLjM3LDM1My40MS00OS4zMy4wM0wyMzcuMzgsMzEuNzVaIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTg2NC44MiwzMS43NWwtMTg2Ljk1LDMyMS43NC01MC40My0uMDVMODM2LjE5LDBoNTcuMjNsMjEwLjM3LDM1My40MS00OS4zMy4wM0w4NjQuODIsMzEuNzVaIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTU1MS44NiwzMjEuNzRMNzM4LjgxLDBsNTAuNDMuMDUtMjA4Ljc0LDM1My40NGgtNTcuMjNMMzEyLjkxLjA3bDQ5LjMzLS4wMywxODkuNjMsMzIxLjdaIi8+CiAgICA8L2c+CiAgPC9nPgo8L3N2Zz4=';

// ── LOGO PLACEMENT — spec: 148 × 47.3972 px, 30 px gap (96 dpi → mm) ────────
const PX   = 0.264583;          // 1px in mm at 96dpi
const LOGO_W  = 148  * PX;      // 39.16mm
const LOGO_H  = 47.3972 * PX;   // 12.54mm
const LOGO_GAP = 30  * PX;      // 7.94mm
const A4W  = 210;
const A4H  = 297;
const LOGO_X  = A4W - LOGO_W - LOGO_GAP;   // 162.90mm
const LOGO_Y  = A4H - LOGO_H - LOGO_GAP;   // 276.52mm

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  base:'#0A0A0F', s1:'#13131A', s2:'#1C1C26',
  violet:'#7C6AF5', violetBg:'#1A1528',
  red:'#E5534B', amber:'#E09B3D', green:'#3FB68A',
  white:'#FFFFFF', sub:'#9090A8', muted:'#5A5A6E', dim:'#3A3A4A',
  quote:'#C8C0F8',
};

// ── AGENT DEFINITIONS ─────────────────────────────────────────────────────────
const AGENTS = [
  { num:'01', name:'THE SABOTEUR',     sub:'Internal Forensics · TIM WOODS · Financial Exposure',
    col:C.red,    colbg:'#2A1515', agentKey:'agent1',
    sections:[
      ['Executive Risk Summary',        'executive_risk_summary',        'executive_risk_summary_finding'],
      ['Operational Risks',             'operational_risks',             'operational_risks_finding'],
      ['Financial Risks',               'financial_risks',               'financial_risks_finding'],
      ['Failure Probability Indicators','failure_probability_indicators','failure_probability_indicators_finding'],
    ]},
  { num:'02', name:'THE PREDATOR',     sub:'External Offensive · Market Analysis · Competitor Simulation',
    col:C.amber,  colbg:'#2A2015', agentKey:'agent2',
    sections:[
      ['Market Saturation Analysis',      'market_saturation_analysis',      'market_saturation_analysis_finding'],
      ['Regional & Geographic Challenges','regional_geographic_challenges',   'regional_geographic_challenges_finding'],
      ['Competitor Attack Analysis',      'competitor_attack_analysis',       'competitor_attack_analysis_finding'],
      ['Customer Psychology Risks',       'customer_psychology_risks',        'customer_psychology_risks_finding'],
    ]},
  { num:'03', name:'THE ORCHESTRATOR', sub:'Strategic Verdict · Investor Perspective · Pivot Roadmap',
    col:C.violet, colbg:'#1A1528', agentKey:'agent3',
    sections:[
      ['Investor Perspective',       'investor_perspective',       'investor_perspective_finding'],
      ['Strategic Recommendations',  'strategic_recommendations',  'strategic_recommendations_finding'],
    ]},
  { num:'04', name:'THE REGULATOR',   sub:'Legal Compliance · Data Privacy · Liability · IP',
    col:C.green,  colbg:'#152A20', agentKey:'agent4',
    sections:[
      ['Regulatory Obligations',      'regulatory_obligations',      'regulatory_obligations_finding'],
      ['Data & Privacy Compliance',   'data_privacy_compliance',     'data_privacy_compliance_finding'],
      ['Liability & Structural Risk', 'liability_structural_risk',   'liability_structural_risk_finding'],
      ['IP & Licensing Exposure',     'ip_licensing_exposure',       'ip_licensing_exposure_finding'],
    ]},
  { num:'05', name:'THE CFO',          sub:'Unit Economics · Burn Scenarios · Margin Fragility · Funding',
    col:C.amber,  colbg:'#2A2015', agentKey:'agent5',
    sections:[
      ['Unit Economics Assessment',      'unit_economics_assessment',  'unit_economics_assessment_finding'],
      ['Burn & Runway Scenarios',        'burn_runway_scenarios',      'burn_runway_scenarios_finding'],
      ['Margin & Growth Fragility',      'margin_growth_fragility',    'margin_growth_fragility_finding'],
      ['Funding & Survival Stress-Test', 'funding_survival_stress',    'funding_survival_stress_finding'],
    ]},
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function rgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function mk(doc){
  const fill=h=>doc.setFillColor(...rgb(h));
  const tc  =h=>doc.setTextColor(...rgb(h));
  const bg  =()=>{fill(C.base);doc.rect(0,0,A4W,A4H,'F');};
  const wrap=(text,x,y,mw,lh)=>{
    if(!text)return y;
    doc.splitTextToSize(String(text),mw).forEach(l=>{
      if(y>A4H-18){doc.addPage();bg();y=24;}
      doc.text(l,x,y);y+=lh;
    });
    return y;
  };
  return{fill,tc,bg,wrap};
}

function scoreCol(s){return s>=70?C.red:s>=45?C.amber:C.green;}
function sevCol(s){return s==='HIGH'?C.red:s==='MEDIUM'?C.amber:C.green;}

function getSection(aData,agentKey,field){
  const v=(aData[agentKey]||{})[field];
  if(v&&typeof v==='object'&&v.skip)return{skipped:true,reason:v.reason||'Not material for this venture.'};
  return{skipped:false,body:typeof v==='string'?v:''};
}
function getFinding(aData,agentKey,fkey){
  const v=(aData[agentKey]||{})[fkey];
  return typeof v==='string'?v:'';
}

// ── LOAD IMAGE HELPER (returns Promise<string> data URL) ─────────────────────
function loadImg(src){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=img.naturalWidth;c.height=img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0);
      res(c.toDataURL('image/jpeg',0.92));
    };
    img.onerror=()=>res(null); // gracefully degrade — cover still works without photo
    img.src=src;
  });
}

// ── COVER PAGE ────────────────────────────────────────────────────────────────
function drawCover(doc,aData,fMeta,bgDataUrl){
  const{fill,tc,bg,wrap}=mk(doc);
  const M=20, CW=A4W-M*2;

  // Background: dark base first, then photo on top
  bg();
  if(bgDataUrl){
    doc.addImage(bgDataUrl,'JPEG',0,0,A4W,A4H);
  }

  // Dark overlay at bottom half so text is always readable
  // Gradient simulation: two semi-transparent dark rects
  fill('#0A0A0F');
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({opacity:0.45}));
  doc.rect(0,0,A4W,A4H,'F');
  doc.restoreGraphicsState();

  // Stronger darkening at very top (for header bar) and bottom
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({opacity:0.55}));
  fill('#0A0A0F');doc.rect(0,0,A4W,22,'F');
  fill('#0A0A0F');doc.rect(0,A4H-12,A4W,12,'F');
  doc.restoreGraphicsState();

  // ── Left white accent bar (matches SVG: x≈0, y=23–74mm) ─────────────────
  fill(C.white);doc.rect(0,23,1.5,51,'F');

  // ── Top header label ──────────────────────────────────────────────────────
  tc(C.white);
  doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setCharSpace(2.8);
  doc.text('ADVERSARIAL VENTURE ANALYSIS',M,14);
  doc.setCharSpace(0);
  // Thin rule under label
  fill('rgba(255,255,255,0.2)');
  fill(C.white);
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({opacity:0.2}));
  doc.rect(M,17,CW,0.3,'F');
  doc.restoreGraphicsState();

  // ── Venture name — large white, split across lines ─────────────────────
  // Matches SVG: lines at y≈36mm, 55mm, 74mm
  tc(C.white);
  doc.setFont('helvetica','bold');doc.setFontSize(32);
  const titleLines=doc.splitTextToSize(fMeta.title||'Venture Audit',CW-10);
  let ty=38;
  titleLines.forEach(line=>{doc.text(line,M,ty);ty+=14;});

  // ── Audit metadata line ────────────────────────────────────────────────
  ty=Math.max(ty+4,80);
  tc(C.white);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({opacity:0.7}));
  const metaParts=[
    fMeta.industry,
    (fMeta.city?fMeta.city+', ':'')+fMeta.country,
    fMeta.delivery,fMeta.budget,
  ].filter(Boolean);
  doc.text(metaParts.join('   ·   '),M,ty);
  doc.restoreGraphicsState();

  // ── Pill badges — metadata tags ───────────────────────────────────────
  // Matches SVG rows of pill badges starting at y≈139mm
  // Render as rounded-rect pills in the lower portion of the page
  const pills=[
    fMeta.industry, (fMeta.city?fMeta.city+', ':'')+fMeta.country,
    fMeta.model||fMeta.delivery, fMeta.budget,
    fMeta.customer?fMeta.customer.slice(0,32):null,
    fMeta.comps?'Competitors: '+fMeta.comps.slice(0,28):null,
  ].filter(Boolean);

  let px=M, py=140, maxRowH=9;
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);
  pills.forEach(pill=>{
    const tw=doc.getTextWidth(pill);
    const pw=tw+10, ph=8;
    if(px+pw>A4W-M){px=M;py+=ph+5;}
    // Pill background
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity:0.15}));
    fill(C.white);doc.roundedRect(px,py-5.5,pw,ph,3,3,'F');
    doc.restoreGraphicsState();
    // Pill border
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity:0.3}));
    doc.setDrawColor(...rgb(C.white));doc.setLineWidth(0.3);
    doc.roundedRect(px,py-5.5,pw,ph,3,3,'S');
    doc.restoreGraphicsState();
    // Pill text
    tc(C.white);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity:0.85}));
    doc.text(pill,px+5,py);
    doc.restoreGraphicsState();
    px+=pw+6;
  });

  // ── Score block ────────────────────────────────────────────────────────
  const scoreY=215;
  const sc=scoreCol(aData.score);
  const sevLabel=aData.score>=70?'HIGH RISK':aData.score>=45?'MODERATE RISK':'LOW RISK';

  // Dark card behind score
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({opacity:0.75}));
  fill(C.s1);doc.roundedRect(M,scoreY,CW,46,4,4,'F');
  doc.restoreGraphicsState();
  // Colour left bar
  fill(sc);doc.rect(M,scoreY,3,46,'F');

  // Label
  tc(C.sub);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setCharSpace(1.8);
  doc.text('RESILIENCE SCORE',M+10,scoreY+11);doc.setCharSpace(0);
  // Score number
  tc(sc);doc.setFontSize(34);
  doc.text(String(aData.score),M+10,scoreY+37);
  // /100
  tc(C.muted);doc.setFont('helvetica','normal');doc.setFontSize(11);
  doc.text('/ 100',M+10+doc.getTextWidth(String(aData.score))+3,scoreY+37);
  // Risk label
  tc(sc);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setCharSpace(1);
  doc.text(sevLabel,A4W-M-3,scoreY+37,{align:'right'});doc.setCharSpace(0);

  // ── Pivot directive ────────────────────────────────────────────────────
  const pivot=aData.agent3?.pivot_directive||'';
  if(pivot){
    const pivY=scoreY+54;
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity:0.8}));
    fill(C.violetBg);doc.roundedRect(M,pivY,CW,20,3,3,'F');
    doc.restoreGraphicsState();
    fill(C.violet);doc.rect(M,pivY,2,20,'F');
    tc(C.violet);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setCharSpace(1.8);
    doc.text('FINAL DIRECTIVE',M+8,pivY+8);doc.setCharSpace(0);
    tc(C.white);doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    const pl=doc.splitTextToSize(pivot,CW-16);
    if(pl[0])doc.text(pl[0],M+8,pivY+16);
  }

  // ── Confidential footer ────────────────────────────────────────────────
  tc(C.dim);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setCharSpace(0.8);
  doc.text('CONFIDENTIAL  ·  AVA INTELLIGENCE',M,A4H-4);
  doc.text('adversarial venture analysis report',A4W-M,A4H-4,{align:'right'});
  doc.setCharSpace(0);

  // ── AVA logo — bottom-right, exact spec ───────────────────────────────
  // 148 × 47.3972 px, 30 px gap (all at 96dpi), converted to mm
  doc.addImage(AVA_LOGO_B64,'SVG',LOGO_X,LOGO_Y,LOGO_W,LOGO_H);
}

// ── AGENT DIVIDER PAGE ────────────────────────────────────────────────────────
function drawDivider(doc,agent){
  const{fill,tc,bg}=mk(doc);
  const M=20;
  bg();fill(agent.colbg);doc.rect(0,0,A4W,A4H,'F');
  fill(agent.col);doc.rect(0,0,4,A4H,'F');
  tc(agent.col);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setCharSpace(2);
  doc.text('AGENT '+agent.num,M,A4H/2-24);doc.setCharSpace(0);
  tc(C.white);doc.setFontSize(30);doc.text(agent.name,M,A4H/2);
  tc(C.sub);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(agent.sub,M,A4H/2+15);
  doc.addImage(AVA_LOGO_B64,'SVG',LOGO_X,LOGO_Y,LOGO_W,LOGO_H);
}

// ── AGENT CONTENT PAGE(S) ─────────────────────────────────────────────────────
function drawContent(doc,agent,aData){
  const{fill,tc,bg,wrap}=mk(doc);
  const M=20,CW=A4W-M*2;

  function hdr(cont){
    bg();
    fill(C.s1);doc.rect(0,0,A4W,27,'F');
    fill(agent.col);doc.rect(0,0,3,27,'F');
    tc(agent.col);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setCharSpace(0.3);
    doc.text('AGENT '+agent.num+'  '+agent.name+(cont?' (continued)':''),M,12);doc.setCharSpace(0);
    tc(C.muted);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(agent.sub,M,20);
    tc(C.dim);doc.setFontSize(7);doc.text(aData.audit_id||'',A4W-M,12,{align:'right'});
  }
  function ftr(){
    fill('#0D0D12');doc.rect(0,A4H-10,A4W,10,'F');
    tc(C.dim);doc.setFont('helvetica','normal');doc.setFontSize(6.5);
    doc.text('AVA Adversarial Venture Analysis  ·  Confidential  ·  '+(aData.audit_id||''),M,A4H-4);
    doc.text('Score: '+aData.score+' / 100',A4W-M,A4H-4,{align:'right'});
  }

  hdr(false);
  let y=36;

  for(const[title,field,fkey]of agent.sections){
    if(y>A4H-52){ftr();doc.addPage();hdr(true);y=36;}
    const sec=getSection(aData,agent.agentKey,field);
    const finding=getFinding(aData,agent.agentKey,fkey);
    const sev=aData.severity?.[field]||'MEDIUM';

    // Section title bar
    fill(C.s2);doc.roundedRect(M,y-5,CW,13,2,2,'F');
    fill(sec.skipped?C.dim:agent.col);doc.rect(M,y-5,3,13,'F');
    tc(sec.skipped?C.muted:C.white);doc.setFont('helvetica','bold');doc.setFontSize(9);
    doc.text(title,M+7,y+4);
    if(sec.skipped){
      tc(C.dim);doc.setFontSize(7.5);doc.setCharSpace(0.8);
      doc.text('NOT APPLICABLE',A4W-M-2,y+4,{align:'right'});doc.setCharSpace(0);
    } else if(sev&&sev!=='N/A'){
      tc(sevCol(sev));doc.setFontSize(8);doc.text(sev,A4W-M-2,y+4,{align:'right'});
    }
    y+=16;

    if(sec.skipped){
      tc(C.dim);doc.setFont('helvetica','italic');doc.setFontSize(8.5);
      doc.text(sec.reason,M+4,y);y+=12;continue;
    }

    // Pull quote
    if(finding){
      if(y>A4H-42){ftr();doc.addPage();hdr(true);y=36;}
      fill('#1A1A2E');doc.roundedRect(M,y-2,CW,13,2,2,'F');
      fill(C.violet);doc.rect(M,y-2,2,13,'F');
      tc(C.quote);doc.setFont('helvetica','italic');doc.setFontSize(8.5);
      const fl=doc.splitTextToSize('"'+finding+'"',CW-12);
      doc.text(fl[0],M+6,y+7);y+=17;
    }

    // Body
    tc(C.sub);doc.setFont('helvetica','normal');doc.setFontSize(9);
    y=wrap(sec.body,M,y,CW,5.5);
    y+=11;
  }
  ftr();
}

// ── FINAL DIRECTIVE PAGE ──────────────────────────────────────────────────────
function drawDirective(doc,aData){
  const{fill,tc,bg}=mk(doc);
  bg();fill('#1C1C2E');doc.rect(0,0,A4W,A4H,'F');
  fill(C.violet);doc.rect(0,0,A4W,3,'F');
  tc(C.muted);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setCharSpace(2.5);
  doc.text('FINAL DIRECTIVE',A4W/2,A4H/2-28,{align:'center'});doc.setCharSpace(0);
  fill(C.violet);doc.rect(A4W/2-18,A4H/2-21,36,0.8,'F');
  tc(C.white);doc.setFontSize(15);
  const dl=doc.splitTextToSize(aData.agent3?.pivot_directive||'',A4W-50);
  let dy=A4H/2-8;dl.forEach(l=>{doc.text(l,A4W/2,dy,{align:'center'});dy+=10;});
  tc(C.muted);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setCharSpace(0.8);
  doc.text('AVA INTELLIGENCE  ·  '+(aData.audit_id||''),A4W/2,A4H-20,{align:'center'});doc.setCharSpace(0);
  doc.addImage(AVA_LOGO_B64,'SVG',LOGO_X,LOGO_Y,LOGO_W,LOGO_H);
}

// ── PUBLIC API ─────────────────────────────────────────────────────────────────
/**
 * Generate and save the AVA audit PDF.
 * @param {object} aData  API response: { score, audit_id, severity, agent1–5 }
 * @param {object} fMeta  Form data: { title, industry, city, country, delivery, budget, model, customer, comps }
 */
async function generateAVAReport(aData,fMeta){
  if(!window.jspdf){
    console.error('AVA Report: jsPDF not loaded.');return;
  }
  const{jsPDF}=window.jspdf;

  // Pre-load background photo (gracefully degrades if missing)
  const bgUrl='./report-bg.jpg';
  const bgDataUrl=await loadImg(bgUrl);

  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});

  // Cover
  drawCover(doc,aData,fMeta,bgDataUrl);

  // Agent sections
  for(const agent of AGENTS){
    doc.addPage();drawDivider(doc,agent);
    doc.addPage();drawContent(doc,agent,aData);
  }

  // Final directive
  if(aData.agent3?.pivot_directive){doc.addPage();drawDirective(doc,aData);}

  // Save
  const safe=(fMeta.title||'Venture').replace(/[^a-zA-Z0-9]/g,'_');
  doc.save('AVA_Audit_'+safe+'_'+new Date().toISOString().slice(0,10)+'.pdf');
}
