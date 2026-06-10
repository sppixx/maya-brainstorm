import { useState, useRef } from "react";

const AGENTS = [
  {
    name: "Визионер",
    icon: "🔭",
    role: "Масштаб · амбиции · будущее",
    color: "#00D4FF",
    bg: "rgba(0,212,255,0.12)",
    system: `Ты — Визионер в мозговом штурме про Maya AI.
Maya AI — ambient AI компаньон для замкнутых пространств (дом, офис, завод). Работает локально, знает пользователя, без wake-word, запатентованная формула активации AIS(z,t) = P(z,t) × Σ[Wi(t)×Ci(z,t)]. Команда: Слава (Hemer, Germany), Максим (Shenzhen), Даниил (Москва). Прототип работает.
Твоя роль: думать масштабно, амбициозно, на 5–10 лет вперёд.
Отвечай конкретно, 3–4 абзаца. На русском. Без вводных фраз типа "Конечно!" или "Отличный вопрос!". Сразу по делу.`
  },
  {
    name: "Практик",
    icon: "⚙️",
    role: "Реализм · деньги · сроки",
    color: "#00E5A0",
    bg: "rgba(0,229,160,0.12)",
    system: `Ты — Практик в мозговом штурме про Maya AI.
Maya AI — ambient AI компаньон для замкнутых пространств (дом, офис, завод). Работает локально, знает пользователя, без wake-word, запатентованная формула активации AIS. Команда маленькая: Слава (lead dev, Hemer), Максим (Shenzhen), Даниил (дизайн). Прототип работает.
Твоя роль: реализм, конкретные цифры, ближайшие 12–18 месяцев. Что реально сделать с небольшой командой.
Отвечай конкретно, 3–4 абзаца. На русском. Без вводных фраз. Сразу по делу.`
  },
  {
    name: "Скептик",
    icon: "🔍",
    role: "Риски · слабые места · вопросы",
    color: "#FF9500",
    bg: "rgba(255,149,0,0.12)",
    system: `Ты — Скептик в мозговом штурме про Maya AI.
Maya AI — ambient AI компаньон для замкнутых пространств (дом, офис, завод). Работает локально, знает пользователя, без wake-word, запатентованная формула активации AIS. Команда: Слава (Hemer), Максим (Shenzhen), Даниил (Москва).
Твоя роль: искать риски, слабые места, неудобные вопросы. НЕ критикуй ради критики — предлагай как снизить риски.
Отвечай конкретно, 3–4 абзаца. На русском. Без вводных фраз. Сразу по делу.`
  }
];

async function callClaude(system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system,
      messages
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(c => c.text || "").join("");
}

export default function App() {
  const [topic, setTopic] = useState("Как Майя должна зарабатывать деньги?");
  const [round, setRound] = useState(0);
  const [maxRound] = useState(3);
  const [running, setRunning] = useState(false);
  const [agentMsgs, setAgentMsgs] = useState([[], [], []]);
  const [statuses, setStatuses] = useState(["idle", "idle", "idle"]);
  const [synthesis, setSynthesis] = useState([]);
  const [synthStatus, setSynthStatus] = useState("idle");
  const [started, setStarted] = useState(false);
  const historyRef = useRef([[], [], []]);
  const prevRepliesRef = useRef([]);

  const setStatus = (i, s) => setStatuses(prev => { const n = [...prev]; n[i] = s; return n; });

  const appendMsg = (i, text, roundN) => {
    setAgentMsgs(prev => {
      const n = prev.map(a => [...a]);
      n[i] = [...n[i], { round: roundN, text }];
      return n;
    });
  };

  const runAgent = async (i, prompt, roundN) => {
    setStatus(i, "thinking");
    historyRef.current[i] = [...historyRef.current[i], { role: "user", content: prompt }];
    try {
      const reply = await callClaude(AGENTS[i].system, historyRef.current[i]);
      historyRef.current[i] = [...historyRef.current[i], { role: "assistant", content: reply }];
      appendMsg(i, reply, roundN);
      setStatus(i, "done");
      return reply;
    } catch (e) {
      appendMsg(i, `Ошибка: ${e.message}`, roundN);
      setStatus(i, "error");
      return "";
    }
  };

  const runSynthesis = async (topic, replies, roundN) => {
    setSynthStatus("thinking");
    const prompt = `Раунд ${roundN} мозгового штурма. Тема: "${topic}"

Визионер: ${replies[0]}

Практик: ${replies[1]}

Скептик: ${replies[2]}

Синтез: выдели 3–4 ключевых идеи этого раунда. Коротко, по делу. На русском.`;
    try {
      const r = await callClaude(
        "Ты модератор мозгового штурма. Синтезируй ключевые идеи кратко.",
        [{ role: "user", content: prompt }]
      );
      setSynthesis(prev => [...prev, { round: roundN, text: r }]);
      setSynthStatus("done");
    } catch (e) {
      setSynthesis(prev => [...prev, { round: roundN, text: `Ошибка: ${e.message}` }]);
      setSynthStatus("error");
    }
  };

  const start = async () => {
    if (running || !topic.trim()) return;
    setRunning(true);
    setStarted(true);
    const r = 1;
    setRound(r);

    const prompt = `Тема: "${topic}"\n\nЭто первый раунд. Выскажи свою позицию.`;
    const replies = await Promise.all([
      runAgent(0, prompt, r),
      runAgent(1, prompt, r),
      runAgent(2, prompt, r)
    ]);
    prevRepliesRef.current = replies;
    await runSynthesis(topic, replies, r);
    setRunning(false);
  };

  const nextRound = async () => {
    if (running || round >= maxRound) return;
    setRunning(true);
    const r = round + 1;
    setRound(r);

    const prev = prevRepliesRef.current;
    const prompt = `Раунд ${r}. Тема: "${topic}"

Что сказали другие в раунде ${r-1}:
Визионер: ${prev[0]}
Практик: ${prev[1]}
Скептик: ${prev[2]}

Отреагируй на их идеи, развей диалог. Не повторяй уже сказанное.`;

    const replies = await Promise.all([
      runAgent(0, prompt, r),
      runAgent(1, prompt, r),
      runAgent(2, prompt, r)
    ]);
    prevRepliesRef.current = replies;
    await runSynthesis(topic, replies, r);
    setRunning(false);
  };

  const reset = () => {
    setRound(0); setRunning(false); setStarted(false);
    setAgentMsgs([[], [], []]); setStatuses(["idle","idle","idle"]);
    setSynthesis([]); setSynthStatus("idle");
    historyRef.current = [[], [], []]; prevRepliesRef.current = [];
  };

  const statusLabel = { idle: "ожидание", thinking: "думает...", done: "готово", error: "ошибка" };
  const statusColor = { idle: "#6B7A8D", thinking: "#00D4FF", done: "#00E5A0", error: "#FF4455" };

  return (
    <div style={{ background:"#080C14", minHeight:"100vh", padding:"24px 20px", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#fff" }}>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:11, letterSpacing:4, color:"#00D4FF", textTransform:"uppercase", marginBottom:8 }}>
          Maya AI · Мозговой штурм
        </div>
        <div style={{ fontSize:26, fontWeight:700, marginBottom:6 }}>Три точки зрения. Один вопрос.</div>
        <div style={{ fontSize:13, color:"#9AABBD" }}>Агенты обсуждают тему между собой</div>
      </div>

      {/* Topic input */}
      <div style={{ display:"flex", gap:10, maxWidth:800, margin:"0 auto 24px" }}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          disabled={started}
          placeholder="Введи тему..."
          style={{
            flex:1, background:"#0E1520", border:"1px solid #1A2840", borderRadius:10,
            padding:"12px 16px", color:"#fff", fontSize:15, outline:"none",
            opacity: started ? 0.6 : 1
          }}
        />
        {!started ? (
          <button onClick={start} disabled={running || !topic.trim()} style={{
            background:"#00D4FF", color:"#080C14", border:"none", borderRadius:10,
            padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer",
            opacity: running ? 0.5 : 1, whiteSpace:"nowrap"
          }}>Запустить</button>
        ) : (
          <button onClick={reset} style={{
            background:"transparent", color:"#FF4455", border:"1px solid #FF4455",
            borderRadius:10, padding:"12px 20px", fontSize:13, cursor:"pointer", whiteSpace:"nowrap"
          }}>Сбросить</button>
        )}
      </div>

      {/* Round dots */}
      {started && (
        <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center", marginBottom:20, fontSize:12, color:"#6B7A8D" }}>
          <span>Раунд</span>
          {[1,2,3].map(i => (
            <div key={i} style={{
              width:10, height:10, borderRadius:"50%",
              background: i < round ? "#00E5A0" : i === round ? "#00D4FF" : "#1A2840",
              transition:"background 0.3s"
            }} />
          ))}
          <span style={{ color:"#00D4FF", fontWeight:600 }}>{round} / {maxRound}</span>
        </div>
      )}

      {/* Agent cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, maxWidth:1100, margin:"0 auto 16px" }}>
        {AGENTS.map((agent, i) => (
          <div key={i} style={{
            background:"#0E1520", borderRadius:14,
            border: `1px solid ${statuses[i]==="thinking" ? agent.color : "#1A2840"}`,
            overflow:"hidden", display:"flex", flexDirection:"column",
            transition:"border-color 0.3s"
          }}>
            {/* Card header */}
            <div style={{ padding:"12px 14px 10px", borderBottom:"1px solid #1A2840", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:agent.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>
                {agent.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{agent.name}</div>
                <div style={{ fontSize:11, color:"#9AABBD", marginTop:1 }}>{agent.role}</div>
              </div>
              <div style={{
                fontSize:10, padding:"3px 9px", borderRadius:20, fontWeight:600,
                background: `${agent.color}22`, color: statusColor[statuses[i]]
              }}>
                {statusLabel[statuses[i]]}
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding:"14px", flex:1, minHeight:180, maxHeight:360, overflowY:"auto", fontSize:13, lineHeight:1.65, color:"#9AABBD" }}>
              {agentMsgs[i].length === 0 && statuses[i] === "idle" && (
                <span style={{ color:"#6B7A8D", fontStyle:"italic" }}>Ожидает запуска...</span>
              )}
              {statuses[i] === "thinking" && agentMsgs[i].length === 0 && (
                <ThinkingDots color={agent.color} />
              )}
              {agentMsgs[i].map((msg, j) => (
                <div key={j}>
                  {j > 0 && <div style={{ fontSize:10, color:"#6B7A8D", letterSpacing:2, textTransform:"uppercase", margin:"12px 0 6px", paddingTop:10, borderTop:"1px solid #1A2840" }}>
                    Раунд {msg.round}
                  </div>}
                  {j === 0 && agentMsgs[i].length > 1 && <div style={{ fontSize:10, color:"#6B7A8D", letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Раунд {msg.round}</div>}
                  {msg.text.split("\n").filter(p=>p.trim()).map((p,k) => (
                    <p key={k} style={{ marginBottom:8 }}>{p}</p>
                  ))}
                  {j === agentMsgs[i].length - 1 && statuses[i] === "thinking" && (
                    <ThinkingDots color={agent.color} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Synthesis */}
      {synthesis.length > 0 && (
        <div style={{ maxWidth:1100, margin:"0 auto 16px", background:"#111B2A", borderRadius:14, border:"1px solid #7B61FF", overflow:"hidden" }}>
          <div style={{ padding:"12px 18px", background:"rgba(123,97,255,0.12)", display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:700, color:"#7B61FF", letterSpacing:1 }}>
            ✦ &nbsp; СИНТЕЗ — ключевые идеи
          </div>
          <div style={{ padding:"16px 18px" }}>
            {synthesis.map((s, i) => (
              <div key={i}>
                {synthesis.length > 1 && <div style={{ fontSize:10, color:"#6B7A8D", letterSpacing:2, textTransform:"uppercase", marginBottom:6, marginTop: i>0?12:0, paddingTop:i>0?10:0, borderTop:i>0?"1px solid #1A2840":"none" }}>Раунд {s.round}</div>}
                {s.text.split("\n").filter(p=>p.trim()).map((p,k) => (
                  <p key={k} style={{ fontSize:13, lineHeight:1.7, color:"#9AABBD", marginBottom:8 }}>{p}</p>
                ))}
              </div>
            ))}
            {synthStatus === "thinking" && <ThinkingDots color="#7B61FF" />}
          </div>
        </div>
      )}

      {/* Controls */}
      {started && (
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          {round < maxRound && (
            <button onClick={nextRound} disabled={running} style={{
              background:"#111B2A", color:"#00D4FF", border:"1px solid #00D4FF",
              borderRadius:10, padding:"10px 24px", fontSize:13, fontWeight:600,
              cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.4 : 1
            }}>
              {running ? "Идёт обсуждение..." : `→ Раунд ${round + 1}`}
            </button>
          )}
          {round >= maxRound && !running && (
            <div style={{ fontSize:13, color:"#00E5A0", padding:"10px 0" }}>
              ✓ Штурм завершён — {maxRound} раунда пройдено
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingDots({ color }) {
  return (
    <span style={{ display:"inline-flex", gap:4, alignItems:"center", padding:"4px 0" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:6, height:6, borderRadius:"50%", background: color,
          display:"inline-block",
          animation: `bounce 1.2s ${i*0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1.1);opacity:1}}`}</style>
    </span>
  );
}
