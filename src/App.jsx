import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Apple, Clock, School, Book, Check, Settings, X, Lock, Trash2, Plus, Home, ShoppingCart, Star } from 'lucide-react';
import './index.css';

// Componentes y Configuración Base
const BASE_TASKS = [
  { id: 'fruit', label: 'Comer fruta', icon: Apple, type: 'multiple', options: ['🍌','🍎','🍈','🍉','🍇','🍑','🍐','🍊','🥝','🍓','🍒'] },
  { id: 'wakeup', label: 'Levantarse a su hora', icon: Clock, type: 'boolean' },
  { id: 'school', label: 'Llegar a tiempo al cole', icon: School, type: 'boolean' },
  { id: 'read', label: 'Leer', icon: Book, type: 'boolean' }
];

const PROGRESS_FACES = ['😴', '🙂', '😊', '😄', '🤩'];

const INITIAL_APP_SETTINGS = {
  enabledTasks: ['fruit', 'wakeup', 'school', 'read'],
  fruitGoal: 2,
  customTasks: [],
  rewards: [
    { id: 'tv_1h', label: '1 Hora de Tele', emoji: '📺', cost: 15 },
    { id: 'tv_30m', label: '30 min de Tele', emoji: '📺', cost: 8 },
    { id: 'park', label: 'Salir al parque', emoji: '🛝', cost: 5 },
    { id: 'soccer', label: 'Fútbol extra', emoji: '⚽', cost: 10 },
    { id: 'icecream', label: 'Helado Especial', emoji: '🍦', cost: 25 }
  ]
};

const INITIAL_STATE = {
  pikachu: {
    name: 'Pikachu',
    theme: 'pikachu',
    avatar: '/avatar_pikachu.png',
    tasks: { fruit: [], wakeup: false, school: false, read: false },
    points: 0
  },
  spiderman: {
    name: 'Spiderman',
    theme: 'spiderman',
    avatar: '/avatar_spiderman.png',
    tasks: { fruit: [], wakeup: false, school: false, read: false },
    points: 0
  }
};

export default function App() {
  const [kidsState, setKidsState] = useState(() => {
    const saved = localStorage.getItem('happyApp_state_v5');
    if (saved) return JSON.parse(saved);
    const old = localStorage.getItem('happyApp_state_v4');
    if (old) {
      const parsed = JSON.parse(old);
      if(parsed.pikachu) parsed.pikachu.points = parsed.pikachu.points ?? parsed.pikachu.coins ?? 0;
      if(parsed.spiderman) parsed.spiderman.points = parsed.spiderman.points ?? parsed.spiderman.coins ?? 0;
      return parsed; 
    }
    return INITIAL_STATE;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('happyApp_settings_v5');
    if (saved) return JSON.parse(saved);
    const old = localStorage.getItem('happyApp_settings_v4');
    if (old) {
      const parsed = JSON.parse(old);
      // Forzamos las nuevas rewards por defecto para reemplazar las antiguas
      return { ...INITIAL_APP_SETTINGS, ...parsed, rewards: INITIAL_APP_SETTINGS.rewards };
    }
    return INITIAL_APP_SETTINGS;
  });

  // UI Modals & Navigation
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker' | 'shop'
  const [activeTab, setActiveTab] = useState('pikachu');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [fruitSelector, setFruitSelector] = useState({ show: false, kidId: null });
  const [purchaseModal, setPurchaseModal] = useState({ show: false, reward: null });

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskEmoji, setNewTaskEmoji] = useState('⭐');

  useEffect(() => {
    localStorage.setItem('happyApp_state_v5', JSON.stringify(kidsState));
  }, [kidsState]);

  useEffect(() => {
    localStorage.setItem('happyApp_settings_v5', JSON.stringify(settings));
  }, [settings]);

  // --- Sincronización Interactiva Cloudflare (Pages API + KV) ---
  const lastSyncStr = useRef("");

  // Subida automática (Debounced)
  useEffect(() => {
    const currentState = JSON.stringify({ kidsState, settings });
    if (currentState === lastSyncStr.current) return;

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch('/api/sync', { method: 'POST', body: currentState });
        if (res.ok) lastSyncStr.current = currentState;
      } catch (e) {
        // Fallback local silencioso si la API no está disponible
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [kidsState, settings]);

  // Bajada/Sondeo automático
  useEffect(() => {
    const fetchSync = async () => {
      try {
        const res = await fetch('/api/sync');
        if (res.ok) {
          const cloudData = await res.json();
          if (!cloudData || !cloudData.kidsState) return;
          
          const cloudStr = JSON.stringify(cloudData);
          if (cloudStr !== lastSyncStr.current) {
            setKidsState(cloudData.kidsState);
            setSettings(cloudData.settings);
            lastSyncStr.current = cloudStr;
          }
        }
      } catch (e) {
        // Ignorado, asumiendo offline o desarrollo local puro
      }
    };

    fetchSync();
    
    // Descarga mágica cuando un padre enciende su móvil para abrir la PWA
    window.addEventListener('focus', fetchSync);
    // Y probando sondeo tranquilo cada 10 segundos
    const poller = setInterval(fetchSync, 10000);
    
    return () => {
      window.removeEventListener('focus', fetchSync);
      clearInterval(poller);
    };
  }, []);

  const COMBINED_TASKS = [...BASE_TASKS, ...settings.customTasks];

  // --- Lógica de Progreso ---
  const getKidProgressStats = (kidId) => {
    const kidTasks = kidsState[kidId].tasks;
    let score = 0;
    let total = 0;

    settings.enabledTasks.forEach(taskId => {
      const taskDef = COMBINED_TASKS.find(t => t.id === taskId);
      if (!taskDef) return;

      if (taskId === 'fruit') {
        const fruitsEaten = kidTasks.fruit ? kidTasks.fruit.length : 0;
        score += Math.min(fruitsEaten, settings.fruitGoal);
        total += settings.fruitGoal;
      } else {
        if (kidTasks[taskId]) score += 1;
        total += 1;
      }
    });

    return { score, total };
  };

  const pikaStats = getKidProgressStats('pikachu');
  const spiderStats = getKidProgressStats('spiderman');
  
  const totalScore = pikaStats.score + spiderStats.score;
  const totalPossible = pikaStats.total + spiderStats.total;
  const teamPercentage = totalPossible === 0 ? 0 : (totalScore / totalPossible) * 100;

  useEffect(() => {
    if (totalScore === totalPossible && totalPossible > 0) {
      triggerConfetti(['#FFD700', '#E23636']);
    }
  }, [totalScore, totalPossible]);

  const triggerConfetti = (colors = ['#FFD700', '#22c55e']) => {
    var duration = 2500;
    var end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  // --- Manejadores Rutina ---
  const handleTaskClick = (kidId, taskId) => {
    if (taskId === 'fruit') return setFruitSelector({ show: true, kidId });
    setKidsState(prev => ({
      ...prev, [kidId]: { ...prev[kidId], tasks: { ...prev[kidId].tasks, [taskId]: !prev[kidId].tasks[taskId] } }
    }));
  };

  const handleFruitSelect = (fruitEmoji) => {
    const kidId = fruitSelector.kidId;
    setKidsState(prev => {
      const currentFruits = prev[kidId].tasks.fruit || [];
      if (currentFruits.includes(fruitEmoji)) return prev; 
      return { ...prev, [kidId]: { ...prev[kidId], tasks: { ...prev[kidId].tasks, fruit: [...currentFruits, fruitEmoji] } } };
    });
    setFruitSelector({ show: false, kidId: null });
  };

  // --- Manejadores Economía ---
  const handleCloseDay = () => {
    if (confirm('¿Cerrar el día y dar los Puntos Estrella? Las tareas diarias volverán a empezar mañana.')) {
      setKidsState(prev => {
        const newState = {...prev};
        
        ['pikachu', 'spiderman'].forEach(kidId => {
          const stats = getKidProgressStats(kidId);
          const earned = stats.score; 
          newState[kidId] = {
            ...newState[kidId],
            points: (newState[kidId].points || 0) + earned,
            tasks: { fruit: [] }
          };
          COMBINED_TASKS.forEach(t => {
            if(t.id !== 'fruit') newState[kidId].tasks[t.id] = false;
          });
        });
        return newState;
      });
      triggerConfetti(['#FFD700', '#FCD34D', '#FFFBEB']);
      alert('¡Puntos Estrella conseguidos! ⭐️');
    }
  };

  const handlePurchase = (kidId) => {
    const reward = purchaseModal.reward;
    if (kidsState[kidId].points >= reward.cost) {
      setKidsState(prev => ({
        ...prev,
        [kidId]: { ...prev[kidId], points: prev[kidId].points - reward.cost }
      }));
      setPurchaseModal({ show: false, reward: null });
      triggerConfetti(['#22c55e', '#ffffff']);
      setTimeout(() => alert(`¡${kidsState[kidId].name} ha conseguido ${reward.label}! 🎉`), 100);
    } else {
      alert(`Ups, a ${kidsState[kidId].name} le faltan ${reward.cost - kidsState[kidId].points} puntos.`);
    }
  };

  // --- Configuración Padres ---
  const handlePinSubmit = () => {
    if (pinInput === '1234') {
      setShowPinModal(false); setPinInput(''); setShowSettings(true);
    } else {
      alert('PIN incorrecto'); setPinInput('');
    }
  };

  const toggleSettingTask = (taskId) => {
    setSettings(prev => {
      const isEnabled = prev.enabledTasks.includes(taskId);
      return {
        ...prev,
        enabledTasks: isEnabled ? prev.enabledTasks.filter(id => id !== taskId) : [...prev.enabledTasks, taskId]
      };
    });
  };

  const createCustomTask = () => {
    if (!newTaskName.trim() || !newTaskEmoji.trim()) return;
    const newId = `custom_${Date.now()}`;
    setSettings(prev => ({
      ...prev,
      customTasks: [...prev.customTasks, { id: newId, label: newTaskName.trim(), emoji: newTaskEmoji.trim(), type: 'boolean', custom: true }],
      enabledTasks: [...prev.enabledTasks, newId]
    }));
    setNewTaskName(''); setNewTaskEmoji('⭐');
  };

  const deleteCustomTask = (taskId) => {
    if (confirm("¿Estás seguro de borrar este reto permanentemente?")) {
      setSettings(prev => ({
        ...prev,
        customTasks: prev.customTasks.filter(t => t.id !== taskId),
        enabledTasks: prev.enabledTasks.filter(id => id !== taskId)
      }));
    }
  };

  // --- Componentes UI Locales ---
  const KidProfile = ({ kidId }) => {
    const kid = kidsState[kidId];
    const stats = getKidProgressStats(kidId);
    const percent = stats.total === 0 ? 0 : stats.score / stats.total;
    let faceIndex = 0;
    if (percent > 0) faceIndex = 1; if (percent >= 0.5) faceIndex = 2; if (percent >= 0.75) faceIndex = 3; if (percent >= 1) faceIndex = 4;
    const currentFace = PROGRESS_FACES[faceIndex];
    
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(kid.name);

    const saveName = () => { setKidsState(p => ({...p, [kidId]: {...p[kidId], name: editName}})); setIsEditing(false); };

    return (
      <div className={`kid-card ${kid.theme}`}>
        <div className="kid-identity" style={{justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
            <img src={kid.avatar} alt={kid.name} className="kid-avatar" />
            {isEditing ? (
              <input value={editName} onChange={e => setEditName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()} className="inline-edit-input" autoFocus />
            ) : (
              <div className="kid-name" onClick={() => setIsEditing(true)}>{kid.name} ✏️</div>
            )}
          </div>
          <div className="coin-badge">
            <Star size={20} color="#FFD700" fill="#FFD700" />
            <span>{kid.points}</span>
          </div>
        </div>

        <div className="face-container">
          <div className="face-emoji">{currentFace}</div>
          <div className="level-text">{percent === 1 ? '¡SÚPER FELIZ!' : `Nivel ${faceIndex}/4`}</div>
        </div>

        <div className="tasks-list">
          {COMBINED_TASKS.filter(t => settings.enabledTasks.includes(t.id)).map(task => {
            if (task.id === 'fruit') {
              const fruits = kid.tasks.fruit || [];
              const isComp = fruits.length >= settings.fruitGoal;
              return (
                <div key={task.id} className="task-wrapper">
                  <button className={`task-button ${isComp ? 'completed' : ''}`} onClick={() => handleTaskClick(kidId, task.id)}>
                    <div className="task-icon-container">{isComp ? <Check size={20} /> : <Apple size={20} />}</div>
                    <span style={{flex: 1}}>{task.label} ({fruits.length}/{settings.fruitGoal})</span>
                    <div style={{fontSize: '1.2rem'}}>{fruits.join('')}</div>
                  </button>
                  {fruits.length > 0 && (
                    <button onClick={() => setKidsState(p => ({...p, [kidId]: {...p[kidId], tasks: {...p[kidId].tasks, fruit: []}}}))} style={{background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', marginTop:'4px', fontSize:'0.8rem'}}>🔄 Reiniciar Fruta</button>
                  )}
                </div>
              );
            }
            const isComp = kid.tasks[task.id];
            return (
              <button key={task.id} className={`task-button ${isComp ? 'completed' : ''}`} onClick={() => handleTaskClick(kidId, task.id)}>
                <div className="task-icon-container">{isComp ? <Check size={20} /> : (task.custom ? <span style={{fontSize:'1.2rem'}}>{task.emoji}</span> : <task.icon size={20} /> )}</div>
                <span>{task.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const ShopView = () => (
    <div className="shop-container">
      <div className="team-header" style={{marginBottom: '20px'}}>
        <h1>Premios Mágicos 🎁</h1>
        <p>¡Usa tus Puntos Súper aquí!</p>
        <div style={{display:'flex', justifyContent:'center', flexWrap: 'wrap', gap:'20px', marginTop:'15px'}}>
          <div className="coin-badge-big pikachu"><img src={kidsState.pikachu.avatar} alt="pika" className="mini-ava" /> <span>{kidsState.pikachu.points} ⭐</span></div>
          <div className="coin-badge-big spiderman"><img src={kidsState.spiderman.avatar} alt="spidey" className="mini-ava" /> <span>{kidsState.spiderman.points} ⭐</span></div>
        </div>
      </div>
      
      <div className="rewards-grid">
        {settings.rewards.map(reward => (
          <div key={reward.id} className="reward-card" onClick={() => setPurchaseModal({ show: true, reward })}>
            <div className="reward-emoji">{reward.emoji}</div>
            <div className="reward-label">{reward.label}</div>
            <div className="reward-cost">{reward.cost} ⭐</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-container">
      {/* Navbar Superior */}
      <div className="top-nav">
        <div style={{display:'flex', gap:'10px'}}>
          <button className={`nav-btn ${currentView==='tracker'?'active':''}`} onClick={()=>setCurrentView('tracker')}><Home size={20}/> Retos</button>
          <button className={`nav-btn ${currentView==='shop'?'active':''}`} onClick={()=>setCurrentView('shop')}><Star size={20}/> Premios</button>
        </div>
        <button className="settings-btn-inline" onClick={() => setShowPinModal(true)}><Settings size={20} /></button>
      </div>

      {currentView === 'tracker' ? (
        <>
          <div className="team-header">
            <h1>Happy Tracker</h1>
            <p>¡Trabajad en equipo para lograr el combo dorado!</p>
            <div className="energy-bar-bg">
              <div className={`energy-bar-fill ${teamPercentage === 100 ? 'full' : ''}`} style={{ width: `${teamPercentage}%` }}></div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
              Energía Súper Equipo: {totalScore}/{totalPossible}
            </div>
          </div>

          <div className="mobile-tabs">
            <button className={`tab-btn ${activeTab === 'pikachu' ? 'active-pika' : ''}`} onClick={() => setActiveTab('pikachu')}>
              <img src={kidsState.pikachu.avatar} alt="Pikachu" /><span>{kidsState.pikachu.name}</span>
            </button>
            <button className={`tab-btn ${activeTab === 'spiderman' ? 'active-spidey' : ''}`} onClick={() => setActiveTab('spiderman')}>
              <img src={kidsState.spiderman.avatar} alt="Spiderman" /><span>{kidsState.spiderman.name}</span>
            </button>
          </div>

          <div className="kids-grid" data-active-tab={activeTab}>
            <KidProfile kidId="pikachu" />
            <KidProfile kidId="spiderman" />
          </div>

          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button className="close-day-btn" onClick={handleCloseDay}>
              ⭐️ Cerrar Día y Dar Puntos
            </button>
          </div>
        </>
      ) : (
        <ShopView />
      )}

      {/* MODALES */}

      {/* Modal Compra */}
      {purchaseModal.show && (
        <div className="modal-overlay" onClick={() => setPurchaseModal({ show: false, reward: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{textAlign:'center'}}>
            <button className="modal-close" onClick={() => setPurchaseModal({ show: false, reward: null })}><X size={24} /></button>
            <h2>{purchaseModal.reward.emoji} {purchaseModal.reward.label}</h2>
            <p style={{color:'var(--text-muted)', marginTop:'5px'}}>Necesita <strong>{purchaseModal.reward.cost} Puntos Estrella</strong>.</p>
            <h3 style={{marginTop:'30px', marginBottom:'15px'}}>¿Quién lo quiere?</h3>
            <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
              <button className="kid-buy-btn pikachu" onClick={() => handlePurchase('pikachu')}>
                <img src={kidsState.pikachu.avatar} alt="pika"/>
                <div>{kidsState.pikachu.name} <br/>({kidsState.pikachu.points}⭐)</div>
              </button>
              <button className="kid-buy-btn spiderman" onClick={() => handlePurchase('spiderman')}>
                <img src={kidsState.spiderman.avatar} alt="spidey"/>
                <div>{kidsState.spiderman.name} <br/>({kidsState.spiderman.points}⭐)</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selectores y PINs previos */}
      {fruitSelector.show && (
        <div className="modal-overlay" onClick={() => setFruitSelector({ show: false, kidId: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setFruitSelector({ show: false, kidId: null })}><X size={24} /></button>
            <h2>¿Qué fruta te has comido?</h2>
            <div className="emoji-grid">
              {BASE_TASKS.find(t=>t.id==='fruit').options.map(emoji => (
                <button key={emoji} className="emoji-btn" onClick={() => handleFruitSelect(emoji)}>{emoji}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPinModal(false)}><X size={24} /></button>
            <Lock size={40} style={{margin:'0 auto', display:'block', color:'var(--text-muted)'}} />
            <h2 style={{textAlign:'center', marginTop:'10px'}}>Zona Padres</h2>
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePinSubmit()} className="pin-input" maxLength={4} autoFocus />
            <button className="base-btn" onClick={handlePinSubmit} style={{width:'100%', marginTop:'15px'}}>Acceder</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay scrollable-modal" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '500px', maxHeight:'90vh', overflowY:'auto'}}>
            <button className="modal-close" onClick={() => setShowSettings(false)}><X size={24} /></button>
            <h2 style={{borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:'15px', marginBottom:'20px'}}>⚙️ Avanzado</h2>
            
            <div className="settings-section" style={{background:'rgba(255,255,255,0.02)', padding:'15px', borderRadius:'12px', border:'1px dashed rgba(255,255,255,0.2)'}}>
              <h3>➕ Añadir Nuevo Reto</h3>
              <div style={{display:'flex', gap:'10px', alignItems:'center', marginTop:'10px'}}>
                <input className="inline-edit-input" style={{flex: 1, fontSize:'1rem', padding:'10px', height:'40px'}} placeholder="Ej: Deberes" value={newTaskName} onChange={e=>setNewTaskName(e.target.value)}/>
                <input className="inline-edit-input" style={{width: '50px', fontSize:'1.2rem', padding:'10px', height:'40px', textAlign:'center'}} placeholder="📚" value={newTaskEmoji} onChange={e=>setNewTaskEmoji(e.target.value)}/>
                <button className="base-btn" style={{padding:'10px'}} onClick={createCustomTask}><Plus size={20}/></button>
              </div>
            </div>

            <div className="settings-section" style={{marginTop:'30px'}}>
              <h3>Retos Activos Hoy</h3>
              {COMBINED_TASKS.map(t => (
                <div key={t.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom: '10px'}}>
                  <label className="setting-toggle" style={{flex: 1, margin: 0}}>
                    <input type="checkbox" checked={settings.enabledTasks.includes(t.id)} onChange={() => toggleSettingTask(t.id)} />
                    <span>{t.custom && t.emoji} {t.label} </span>
                  </label>
                  {t.custom && (
                    <button onClick={() => deleteCustomTask(t.id)} style={{background:'rgba(226, 54, 54, 0.2)', color:'#E23636', border:'none', borderRadius:'12px', width:'50px', height:'54px', cursor:'pointer'}}><Trash2 size={24}/></button>
                  )}
                </div>
              ))}
            </div>

            <div className="settings-section" style={{marginTop:'30px', padding:'15px', background:'rgba(255,255,255,0.05)', borderRadius:'12px'}}>
              <h3>Base de Datos (Cloudflare KV)</h3>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>La APP funciona guardando copias instantáneas localmente y sincronizándolas de fondo con el Cloudflare Pages KV API cuando usas `wrangler` o en Producción.</p>
            </div>

            <button className="base-btn" onClick={() => setShowSettings(false)} style={{width:'100%', marginTop:'30px'}}>Cerrar</button>
          </div>
        </div>
      )}

    </div>
  );
}
