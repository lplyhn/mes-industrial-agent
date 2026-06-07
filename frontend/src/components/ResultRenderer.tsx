import React from "react";
import { ProductionChart } from "./ProductionChart";

// =============== Try parse JSON result ===============
function tryParse(raw: string | undefined): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// =============== Detect data type ===============
function detectType(data: any): string {
  if (!data) return "none";
  // equipment summary (check before items since it may have both)
  if (data.alarm !== undefined || data.alarm_devices) return "equipment";
  // quality summary
  if (data.defect_rate !== undefined || data.risk_level) return "quality";
  // production summary
  if (data.total_output !== undefined || data.avg_oee !== undefined) return "production";
  // daily report data bundle
  if (data.workorders && data.production) return "daily_report";
  // items array
  if (data.items && Array.isArray(data.items)) {
    if (data.items.length > 0) {
      const first = data.items[0];
      if (first.id && first.line && first.status && first.planned_qty !== undefined) return "workorders";
    }
    return "items_list";
  }
  // Simple summary
  if (data.total !== undefined || data.completed !== undefined) return "summary";
  return "none";
}

// =============== WorkOrderTable ===============
const STATUS_BADGES: Record<string, {bg:string,color:string,label:string}> = {
  completed: {bg:"#e8f5e9",color:"#2e7d32",label:"已完成"},
  running:   {bg:"#e3f2fd",color:"#1565c0",label:"进行中"},
  delayed:   {bg:"#fbe9e7",color:"#c62828",label:"延期"},
  planned:   {bg:"#fff3e0",color:"#e65100",label:"计划"},
};
function getBadge(s: string) { return STATUS_BADGES[s] || {bg:"#f5f5f5",color:"#666",label:s}; }

const WorkOrderTable: React.FC<{items:any[]}> = ({items}) => {
  if (!items || items.length===0) return null;
  return (
    <div style={{overflowX:"auto",marginTop:8}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:"1px solid #e0e0e0",borderRadius:6}}>
        <thead>
          <tr style={{backgroundColor:"#fafafa"}}>
            <th style={thStyle}>工单ID</th>
            <th style={thStyle}>产线</th>
            <th style={thStyle}>产品</th>
            <th style={thStyle}>状态</th>
            <th style={thStyle}>计划</th>
            <th style={thStyle}>完成</th>
            <th style={thStyle}>完成率</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0,8).map((wo:any,i:number) => {
            const badge = getBadge(wo.status);
            const rate = wo.planned_qty ? Math.round(wo.completed_qty/wo.planned_qty*100) : 0;
            return (
              <tr key={wo.id||i} style={{borderBottom:"1px solid #f0f0f0",backgroundColor:i%2===0?"#fff":"#fafafa"}}>
                <td style={tdStyle}>{wo.id}</td>
                <td style={tdStyle}>{wo.line}线</td>
                <td style={tdStyle}>{wo.product||"-"}</td>
                <td style={tdStyle}>
                  <span style={{display:"inline-block",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:500,backgroundColor:badge.bg,color:badge.color}}>{badge.label}</span>
                </td>
                <td style={{...tdStyle,textAlign:"right"}}>{wo.planned_qty}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{wo.completed_qty}</td>
                <td style={{...tdStyle,textAlign:"right"}}>
                  <span style={{color:rate<50?"#c62828":rate<90?"#e65100":"#2e7d32"}}>{rate}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
const thStyle:React.CSSProperties = {padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#555",fontSize:11,borderBottom:"2px solid #e0e0e0",whiteSpace:"nowrap"};
const tdStyle:React.CSSProperties = {padding:"7px 10px",fontSize:12,color:"#333",whiteSpace:"nowrap"};

// =============== EquipmentCards ===============
const EquipmentCards: React.FC<{alarm:number,maintenance:number,total:number,alarmDevices?:any[]}> = ({alarm,maintenance,total,alarmDevices}) => (
  <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
    <Card icon="✅" label="运行" value={total-alarm-maintenance} color="#2e7d32" bg="#e8f5e9" />
    <Card icon="🚨" label="报警" value={alarm} color="#c62828" bg="#fbe9e7" />
    <Card icon="🔧" label="维修" value={maintenance} color="#e65100" bg="#fff3e0" />
    {alarmDevices && alarmDevices.length>0 && (
      <div style={{width:"100%",marginTop:4}}>
        <div style={{fontSize:12,fontWeight:600,color:"#c62828",marginBottom:4}}>报警设备：</div>
        {alarmDevices.map((d:any,i:number) => (
          <div key={i} style={{fontSize:11,color:"#666",padding:"4px 8px",backgroundColor:"#fff5f5",borderRadius:4,marginBottom:2}}>
            <strong>{d.id||d}</strong> {d.alarm_code ? `(${d.alarm_code})` : ""} {d.temperature ? `${d.temperature}°C` : ""}
          </div>
        ))}
      </div>
    )}
  </div>
);

const Card: React.FC<{icon:string,label:string,value:number,color:string,bg:string}> = ({icon,label,value,color,bg}) => (
  <div style={{flex:1,minWidth:80,padding:"10px 12px",backgroundColor:bg,borderRadius:8,textAlign:"center",border:"1px solid",borderColor:color+"20"}}>
    <div style={{fontSize:20}}>{icon}</div>
    <div style={{fontSize:18,fontWeight:700,color,marginTop:2}}>{value}</div>
    <div style={{fontSize:11,color:"#666",marginTop:2}}>{label}</div>
  </div>
);

// =============== QualityCards ===============
const QualityCards: React.FC<{defectRate:number,riskLevel:string,dominantDefect?:string,defectDist?:Record<string,{count:number,percentage:number}>}> = ({defectRate,riskLevel,dominantDefect,defectDist}) => {
  const risk = riskLevel||"normal";
  const cfg: Record<string,{icon:string,color:string,bg:string,label:string}> = {
    critical: {icon:"🔥",color:"#c62828",bg:"#fbe9e7",label:"严重异常"},
    warning:  {icon:"⚠️",color:"#e65100",bg:"#fff3e0",label:"需关注"},
    normal:   {icon:"✅",color:"#2e7d32",bg:"#e8f5e9",label:"正常"},
  };
  const rc = cfg[risk]||cfg.normal;
  return (
    <div style={{marginTop:8}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",backgroundColor:rc.bg,borderRadius:8,border:"1px solid",borderColor:rc.color+"30",marginBottom:8}}>
        <span style={{fontSize:24}}>{rc.icon}</span>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:rc.color}}>{rc.label}</div>
          <div style={{fontSize:11,color:"#555"}}>不良率：{defectRate}%</div>
        </div>
      </div>
      {dominantDefect && (
        <div style={{fontSize:12,color:"#666",padding:"6px 12px",backgroundColor:"#f5f5f5",borderRadius:6,marginBottom:6}}>
          主导缺陷：<strong>{dominantDefect}</strong>
        </div>
      )}
      {defectDist && Object.keys(defectDist).length>0 && (
        <div style={{marginTop:4}}>
          <div style={{fontSize:11,fontWeight:600,color:"#666",marginBottom:4}}>缺陷分布：</div>
          {Object.entries(defectDist).map(([type,info]:[string,any],i:number) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <span style={{fontSize:11,color:"#555",width:100,textAlign:"right"}}>{type}</span>
              <div style={{flex:1,height:16,backgroundColor:"#f0f0f0",borderRadius:8,overflow:"hidden",position:"relative"}}>
                <div style={{height:"100%",width:`${info.percentage}%`,backgroundColor:info.percentage>50?"#c62828":info.percentage>30?"#e65100":"#1976d2",borderRadius:8,transition:"width 0.5s"}} />
              </div>
              <span style={{fontSize:11,color:"#666",width:50}}>{info.count}个</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =============== ProductionChart (simple bar) ===============
const SimpleProductionChart: React.FC<{totalOutput:number,avgOee:number,achievementRate?:number}> = ({totalOutput,avgOee,achievementRate}) => (
  <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
    <Card icon="📊" label="总产量" value={totalOutput} color="#1565c0" bg="#e3f2fd" />
    <Card icon="⭐" label="平均OEE" value={avgOee} color="#2e7d32" bg="#e8f5e9" />
    {achievementRate !== undefined && (
      <div style={{flex:1,minWidth:80,padding:"10px 12px",backgroundColor:"#fff3e0",borderRadius:8,textAlign:"center",border:"1px solid #e6510020"}}>
        <div style={{fontSize:20}}>🎯</div>
        <div style={{fontSize:18,fontWeight:700,color:"#e65100",marginTop:2}}>{achievementRate}%</div>
        <div style={{fontSize:11,color:"#666",marginTop:2}}>达成率</div>
      </div>
    )}
  </div>
);

// =============== DailyReport ===============
const SectionTitle: React.FC<{icon:string,title:string,color:string}> = ({icon,title,color}) => (
  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:12,marginBottom:6}}>
    <span>{icon}</span>
    <span style={{fontSize:13,fontWeight:600,color}}>{title}</span>
    <div style={{flex:1,height:1,backgroundColor:"#e8e8e8"}} />
  </div>
);

const DailyReportDashboard: React.FC<{data:any}> = ({data}) => {
  const w=data.workorders||{}; const p=data.production||{}; const q=data.quality||{}; const e=data.equipment||{};
  const prodItems = Array.isArray(p) ? p : (p.items || []);
  const woItems = Array.isArray(w) ? w : (w.items || []);
  
  
  return (
    <div style={{marginTop:8}}>
      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div style={{padding:10,backgroundColor:"#e3f2fd",borderRadius:8,border:"1px solid #bbdefb"}}>
          <div style={{fontSize:11,color:"#1565c0",fontWeight:600}}>工单</div>
          <div style={{fontSize:20,fontWeight:700,color:"#1565c0"}}>{w.total||0}</div>
          <div style={{fontSize:10,color:"#666"}}>完成{w.completed||0} | 延期{w.delayed||0}</div>
        </div>
        <div style={{padding:10,backgroundColor:"#e8f5e9",borderRadius:8,border:"1px solid #c8e6c9"}}>
          <div style={{fontSize:11,color:"#2e7d32",fontWeight:600}}>产量</div>
          <div style={{fontSize:20,fontWeight:700,color:"#2e7d32"}}>{p.total_output||0}</div>
          <div style={{fontSize:10,color:"#666"}}>OEE {p.avg_oee||"-"}</div>
        </div>
        <div style={{padding:10,backgroundColor:"#fbe9e7",borderRadius:8,border:"1px solid #ffccbc"}}>
          <div style={{fontSize:11,color:"#c62828",fontWeight:600}}>质量</div>
          <div style={{fontSize:20,fontWeight:700,color:"#c62828"}}>{q.defect_rate||0}%</div>
          <div style={{fontSize:10,color:"#666"}}>不良率</div>
        </div>
        <div style={{padding:10,backgroundColor:"#fff3e0",borderRadius:8,border:"1px solid #ffe0b2"}}>
          <div style={{fontSize:11,color:"#e65100",fontWeight:600}}>设备</div>
          <div style={{fontSize:20,fontWeight:700,color:"#e65100"}}>{e.alarm||0}</div>
          <div style={{fontSize:10,color:"#666"}}>报警中</div>
        </div>
      </div>

      {/* 产量与OEE */}
      <SectionTitle icon="📊" title="产量与OEE" color="#2e7d32" />
      {prodItems.length > 0 && <ProductionChart items={prodItems} totalOutput={p.total_output||0} avgOee={p.avg_oee||0} achievementRate={p.achievement_rate} />}

      {/* 质量风险 */}
      <SectionTitle icon="🔬" title="质量风险" color="#c62828" />
      <QualityCards defectRate={q.defect_rate||0} riskLevel={q.risk_level||"normal"} defectDist={q.defect_distribution} />

      {/* 设备报警 */}
      <SectionTitle icon="🚨" title="设备报警" color="#e65100" />
      <EquipmentCards alarm={e.alarm||0} maintenance={e.maintenance||0} total={e.total||0} alarmDevices={e.alarm_devices} />

      {/* 工单详情 */}
      <SectionTitle icon="📋" title="工单执行详情" color="#1565c0" />
      <WorkOrderTable items={woItems} />
    </div>
  );
};

// =============== SummaryRow ===============
const SummaryRow: React.FC<{data:any}> = ({data}) => {
  const parts:string[]=[];
  if(data.total!==undefined) parts.push(`总${data.total}`);
  if(data.completed!==undefined) parts.push(`已完成${data.completed}`);
  if(data.delayed!==undefined) parts.push(`延期${data.delayed}`);
  if(data.completion_rate!==undefined) parts.push(`完成率${data.completion_rate}%`);
  if(data.running!==undefined) parts.push(`进行中${data.running}`);
  if(parts.length===0) return null;
  return (
    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
      {parts.map((p,i)=><span key={i} style={{fontSize:11,color:"#666",backgroundColor:"#f5f5f5",padding:"3px 10px",borderRadius:12}}>{p}</span>)}
    </div>
  );
};

// =============== Main Renderer ===============
interface Props {
  data: any;
}

export const ResultRenderer: React.FC<Props> = ({data}) => {
  const dtype = detectType(data);
  switch(dtype) {
    case "workorders":
      return (
        <div style={{marginTop:8}}>
          {data.summary && <SummaryRow data={data.summary} />}
          <WorkOrderTable items={data.items} />
        </div>
      );
    case "equipment":
      return <EquipmentCards alarm={data.alarm||0} maintenance={data.maintenance||0} total={data.total||0} alarmDevices={data.alarm_devices} />;
    case "quality":
      return <QualityCards defectRate={data.defect_rate||data.defectRate||0} riskLevel={data.risk_level||data.riskLevel||"normal"} dominantDefect={data.dominant_defect||data.dominantDefect} defectDist={data.defect_distribution||data.defectDist} />;
    case "production":
      return <ProductionChart items={data.items||[]} totalOutput={data.total_output||0} avgOee={data.avg_oee||0} achievementRate={data.achievement_rate} />;
    case "daily_report":
      return <DailyReportDashboard data={data} />;
    case "items_list":
      return <WorkOrderTable items={data.items} />;
    case "summary":
      return <SummaryRow data={data} />;
    default:
      return null;
  }
};

// =============== ToolResultView ===============
interface ToolResultViewProps {
  results: {tool_name: string; data: any}[];
}

export const ToolResultView: React.FC<ToolResultViewProps> = ({results}) => {
  if (!results || results.length===0) return null;
  return (
    <div>
      {results.map((r,i) => (
        <ResultRenderer key={i} data={r.data} />
      ))}
    </div>
  );
};


