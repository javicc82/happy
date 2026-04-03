import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Apple, Check, Settings, X, Lock, Trash2, Plus, ShoppingCart, Star } from 'lucide-react';
import './index.css';

// Componentes y Configuración Base
const BASE_TASKS = [
  { id: 'fruit',   label: 'Comer fruta',           type: 'multiple', icon: Apple, options: ['🍌','🍎','🍈','🍉','🍇','🍑','🍐','🍊','🥝','🍓','🍒'] },
  { id: 'teeth',   label: 'Lavarse los dientes',    type: 'boolean', icon: null },
  { id: 'hands',   label: 'Lavarse las manos',      type: 'boolean', icon: null },
  { id: 'toys',    label: 'Recoger los juguetes',   type: 'boolean', icon: null },
  { id: 'eat',     label: 'Comer lo que toque',     type: 'boolean', icon: null },
  { id: 'dress',   label: 'Vestirse sin ayuda',     type: 'boolean', icon: null },
];

const PROGRESS_FACES = ['😴', '🙂', '😊', '😄', '🤩'];

const INITIAL_APP_SETTINGS = {
  enabledTasks: ['fruit', 'teeth', 'hands', 'toys', 'eat', 'dress'],
  fruitGoal: 2,
  customTasks: [],
  lastResetDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  rewards: [
    { id: 'tv_1h', label: '1 Hora de Tele', emoji: '📺', cost: 15 },
    { id: 'tv_30m', label: '30 min de Tele', emoji: '📺', cost: 8 },
    { id: 'park', label: 'Salir al parque', emoji: '🛝', cost: 5 },
    { id: 'soccer', label: 'Fútbol extra', emoji: '⚽', cost: 10 },
    { id: 'boardgame', label: 'Juego de mesa', emoji: '🎲', cost: 20 }
  ]
};

const INITIAL_STATE = {
  pikachu: {
    name: 'Pikachu',
    theme: 'pikachu',
    avatar: '/avatar_pikachu.png',
    tasks: { fruit: [], teeth: false, hands: false, toys: false, eat: false, dress: false },
    points: 0
  },
  spiderman: {
    name: 'Spiderman',
    theme: 'spiderman',
    avatar: '/avatar_spiderman.png',
    tasks: { fruit: [], teeth: false, hands: false, toys: false, eat: false, dress: false },
    points: 0
  }
};

export default function App() {
  const [kidsState, setKidsState] = useState(() => {
    const saved = localStorage.getItem('happyApp_state_v6');
    if (saved) return JSON.parse(saved);
    const old = localStorage.getItem('happyApp_state_v5');
    if (old) {
      const parsed = JSON.parse(old);
      if(parsed.pikachu) parsed.pikachu.points = parsed.pikachu.points ?? parsed.pikachu.coins ?? 0;
      if(parsed.spiderman) parsed.spiderman.points = parsed.spiderman.points ?? parsed.spiderman.coins ?? 0;
      return parsed; 
    }
    return INITIAL_STATE;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('happyApp_settings_v6');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migración: si existe 'icecream', lo cambiamos por el nuevo 'boardgame'
      if (parsed.rewards && parsed.rewards.some(r => r.id === 'icecream')) {
        parsed.rewards = parsed.rewards.map(r => 
          r.id === 'icecream' ? { id: 'boardgame', label: 'Juego de mesa', emoji: '🎲', cost: 20 } : r
        );
      }
      return parsed;
    }
    const old = localStorage.getItem('happyApp_settings_v4');
    if (old) {
      const parsed = JSON.parse(old);
      // Forzamos las nuevas rewards por defecto para reemplazar las antiguas
      return { ...INITIAL_APP_SETTINGS, ...parsed, rewards: INITIAL_APP_SETTINGS.rewards };
    }
    return INITIAL_APP_SETTINGS;
  });

  // UI Modals & Navigation
  const [activeTab, setActiveTab] = useState('pikachu');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [fruitSelector, setFruitSelector] = useState({ show: false, kidId: null });
  const [activeShopKid, setActiveShopKid] = useState(null);
  const [purchaseModal, setPurchaseModal] = useState({ show: false, reward: null });
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskEmoji, setNewTaskEmoji] = useState('⭐');

  // --- Toast System ---
  const showToast = (message, type = 'info', emoji = '') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, emoji }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmModal({ show: true, message, onConfirm });
  };

  const handleConfirmYes = () => {
    confirmModal.onConfirm?.();
    setConfirmModal({ show: false, message: '', onConfirm: null });
  };

  const handleConfirmNo = () => {
    setConfirmModal({ show: false, message: '', onConfirm: null });
  };

  useEffect(() => {
    localStorage.setItem('happyApp_state_v6', JSON.stringify(kidsState));
  }, [kidsState]);

  useEffect(() => {
    localStorage.setItem('happyApp_settings_v6', JSON.stringify(settings));
  }, [settings]);
  
  // Bloquear scroll del body al abrir modales
  useEffect(() => {
    const isModalOpen = fruitSelector.show || showPinModal || showSettings || activeShopKid;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [fruitSelector.show, showPinModal, showSettings, activeShopKid]);

  // --- Sincronización Interactiva Cloudflare (Pages API + KV) ---
  const lastSyncStr = useRef("");
  const apiAvailable = useRef(true);

  // Subida automática (Debounced)
  useEffect(() => {
    const currentState = JSON.stringify({ kidsState, settings });
    if (currentState === lastSyncStr.current) return;

    const timeoutId = setTimeout(async () => {
      if (!apiAvailable.current) return;
      try {
        const res = await fetch('/api/sync', { method: 'POST', body: currentState });
        if (res.status === 404) {
          apiAvailable.current = false;
          return;
        }
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
      if (!apiAvailable.current) return;
      try {
        const res = await fetch('/api/sync');
        if (res.status === 404) {
          apiAvailable.current = false;
          console.log("Modo Offline Local: API no detectada en dev local.");
          return;
        }
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

  // --- Auto-Reset Diario Automático ---
  useEffect(() => {
    const checkReset = () => {
      const today = new Date().toISOString().split('T')[0];
      if (settings.lastResetDate !== today) {
        // Ejecutar reset automático
        setKidsState(prev => {
          const newState = {...prev};
          ['pikachu', 'spiderman'].forEach(kidId => {
            newState[kidId] = {
              ...newState[kidId],
              tasks: { fruit: [] }
            };
            COMBINED_TASKS.forEach(t => {
              if(t.id !== 'fruit') newState[kidId].tasks[t.id] = false;
            });
          });
          return newState;
        });
        
        setSettings(prev => ({ ...prev, lastResetDate: today }));
        console.log("Día reiniciado automáticamente: ", today);
      }
    };

    checkReset();
    window.addEventListener('focus', checkReset);
    return () => window.removeEventListener('focus', checkReset);
  }, [settings.lastResetDate, COMBINED_TASKS]);

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
    
    setKidsState(prev => {
      const isChecking = !prev[kidId].tasks[taskId];
      const pointChange = isChecking ? 1 : -1;
      
      return {
        ...prev, 
        [kidId]: { 
          ...prev[kidId], 
          points: Math.max(0, (prev[kidId].points || 0) + pointChange),
          tasks: { ...prev[kidId].tasks, [taskId]: isChecking } 
        }
      };
    });
  };

  const handleFruitSelect = (fruitEmoji) => {
    const kidId = fruitSelector.kidId;
    setKidsState(prev => {
      const currentFruits = prev[kidId].tasks.fruit || [];
      if (currentFruits.includes(fruitEmoji)) return prev; 
      
      const newFruits = [...currentFruits, fruitEmoji];
      // Solo sumamos punto si aún no hemos superado ya el objetivo diario
      const earnedPoint = newFruits.length <= settings.fruitGoal;
      
      return { 
        ...prev, 
        [kidId]: { 
          ...prev[kidId], 
          points: earnedPoint ? (prev[kidId].points || 0) + 1 : prev[kidId].points,
          tasks: { ...prev[kidId].tasks, fruit: newFruits } 
        } 
      };
    });
    setFruitSelector({ show: false, kidId: null });
  };

  // --- Manejadores Economía ---
  const handleCloseDay = () => {
    showConfirm('¿Resetear todos los retos manualmente ahora?', () => {
      setKidsState(prev => {
        const newState = {...prev};
        ['pikachu', 'spiderman'].forEach(kidId => {
          newState[kidId] = { ...newState[kidId], tasks: { fruit: [] } };
          COMBINED_TASKS.forEach(t => { if(t.id !== 'fruit') newState[kidId].tasks[t.id] = false; });
        });
        return newState;
      });
      triggerConfetti(['#FFD700', '#FCD34D']);
      showToast('¡Retos reiniciados! Listos para mañana.', 'success', '☀️');
    });
  };

  const handlePurchase = (reward) => {
    const kidId = activeShopKid;
    if (kidsState[kidId].points >= reward.cost) {
      setKidsState(prev => ({
        ...prev,
        [kidId]: { ...prev[kidId], points: prev[kidId].points - reward.cost }
      }));
      triggerConfetti(['#22c55e', '#ffffff']);
      showToast(`¡${kidsState[kidId].name} ha conseguido ${reward.label}!`, 'success', reward.emoji);
    } else {
      showToast(`Faltan ${reward.cost - kidsState[kidId].points} ⭐ para ${reward.label}`, 'error', '😕');
    }
  };

  // --- Configuración Padres ---
  const handlePinSubmit = () => {
    if (pinInput === '1234') {
      setShowPinModal(false); setPinInput(''); setShowSettings(true);
    } else {
      showToast('PIN incorrecto. Inténtalo de nuevo.', 'error', '🔒');
      setPinInput('');
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
    if (!newTaskName.trim()) return;
    const newId = `custom_${Date.now()}`;
    setSettings(prev => ({
      ...prev,
      customTasks: [...prev.customTasks, { id: newId, label: newTaskName.trim(), emoji: '', type: 'boolean', custom: true }],
      enabledTasks: [...prev.enabledTasks, newId]
    }));
    setNewTaskName('');
  };

  const deleteCustomTask = (taskId) => {
    showConfirm('¿Borrar este reto permanentemente?', () => {
      setSettings(prev => ({
        ...prev,
        customTasks: prev.customTasks.filter(t => t.id !== taskId),
        enabledTasks: prev.enabledTasks.filter(id => id !== taskId)
      }));
      showToast('Reto eliminado.', 'info', '🗑️');
    });
  };

  // --- Renderizado de Pestañas (Editables en móvil) ---
  const KidNameTab = ({ kidId }) => {
    const kid = kidsState[kidId];
    const [isEditingTab, setIsEditingTab] = useState(false);
    const [editTabName, setEditTabName] = useState(kid.name);
    
    // Sincronizar el nombre si cambió desde otro lado o nube
    useEffect(() => setEditTabName(kid.name), [kid.name]);

    const saveTabName = (e) => {
      if (e) e.stopPropagation();
      setKidsState(p => ({...p, [kidId]: {...p[kidId], name: editTabName}}));
      setIsEditingTab(false);
    };

    return (
      <button 
        className={`tab-btn ${activeTab === kidId ? (kidId==='pikachu'?'active-pika':'active-spidey') : ''}`} 
        onClick={() => !isEditingTab && setActiveTab(kidId)}
      >
        <img src={kid.avatar} alt={kid.name} />
        {isEditingTab ? (
          <input 
            value={editTabName} 
            onChange={e => setEditTabName(e.target.value)} 
            onBlur={saveTabName} 
            onKeyDown={e => e.key === 'Enter' && saveTabName(e)} 
            onClick={e => e.stopPropagation()}
            className="inline-edit-input" 
            style={{ width: '90px', padding: '2px 5px', fontSize: '1rem' }} 
            autoFocus 
          />
        ) : (
          <span style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <span>{kid.name}</span>
            {activeTab === kidId && (
              <span 
                onClick={(e) => { e.stopPropagation(); setIsEditingTab(true); }} 
                className="tab-edit-btn"
                style={{ fontSize: '0.8rem', opacity: 0.7, padding: '5px' }}
              >✏️</span>
            )}
          </span>
        )}
      </button>
    );
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

    useEffect(() => setEditName(kid.name), [kid.name]);

    const saveName = () => { setKidsState(p => ({...p, [kidId]: {...p[kidId], name: editName}})); setIsEditing(false); };

    return (
      <div className={`kid-card ${kid.theme}`}>
        <div className="kid-identity" style={{justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{display:'flex', gap:'12px', alignItems:'center', maxWidth: '70%'}}>
            <img src={kid.avatar} alt={kid.name} className="kid-avatar" />
            <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', overflow:'hidden'}}>
              {isEditing ? (
                <input value={editName} onChange={e => setEditName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()} className="inline-edit-input card-edit-btn" style={{width: '100%', padding: '5px'}} autoFocus />
              ) : (
                <div className="kid-name card-edit-btn" onClick={() => setIsEditing(true)} style={{display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', width:'100%'}}>
                  <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{kid.name}</span>
                  <span style={{fontSize:'1.2rem', opacity:0.6, flexShrink:0}}>✏️</span>
                </div>
              )}
              {/* Fallback visual puro del nombre en móvil (no editable) */}
              <div className="kid-name mobile-only-name" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                {kid.name}
              </div>
            </div>
          </div>
          <button
            className="coin-badge coin-badge-tappable"
            onClick={() => setActiveShopKid(kidId)}
            title="Canjear puntos"
            style={{flexShrink:0}}
          >
            <Star size={16} color="#FFD700" fill="#FFD700" />
            <span className="coin-pts">{kid.points}</span>
            <span className="coin-hint">Canjear</span>
          </button>
        </div>

        <div className="face-container">
          <span className="face-emoji">{currentFace}</span>
          <span className="level-text">{percent === 1 ? '¡SÚPER FELIZ!' : `Nivel ${faceIndex}/4`}</span>
        </div>

        <div className="tasks-list">
          {COMBINED_TASKS.filter(t => settings.enabledTasks.includes(t.id)).map(task => {
            if (task.id === 'fruit') {
              const fruits = kid.tasks.fruit || [];
              const isComp = fruits.length >= settings.fruitGoal;
              return (
                <div key={task.id} className="task-wrapper">
                  <button className={`task-button ${isComp ? 'completed' : ''}`} onClick={() => handleTaskClick(kidId, task.id)}>
                    <span className="task-check">{isComp ? '✓' : '○'}</span>
                    <span className="task-label">{task.label} <small style={{opacity:0.6}}>({fruits.length}/{settings.fruitGoal})</small></span>
                    {fruits.length > 0 && <span className="task-fruits">{fruits.join('')}</span>}
                  </button>
                  {fruits.length > 0 && (
                    <button onClick={() => setKidsState(p => ({...p, [kidId]: {...p[kidId], tasks: {...p[kidId].tasks, fruit: []}}}))} style={{background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', marginTop:'3px', fontSize:'0.75rem', paddingLeft:'8px'}}>↺ Reiniciar fruta</button>
                  )}
                </div>
              );
            }
            const isComp = kid.tasks[task.id];
            return (
              <button key={task.id} className={`task-button ${isComp ? 'completed' : ''}`} onClick={() => handleTaskClick(kidId, task.id)}>
                <span className="task-check">{isComp ? '✓' : '○'}</span>
                <span className="task-label">{task.custom ? `${task.emoji} ` : ''}{task.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container" style={{paddingTop: 0}}>
      {/* Cabecera Minimalista: Tabs Sticky */}
      <div className="mobile-tabs sticky-header">
        <KidNameTab kidId="pikachu" />
        <KidNameTab kidId="spiderman" />
      </div>

      <div className="kids-grid" data-active-tab={activeTab}>
        <KidProfile kidId="pikachu" />
        <KidProfile kidId="spiderman" />
      </div>

      <footer className="app-footer">
        <button className="settings-footer-btn" onClick={() => setShowPinModal(true)}>
          <Settings size={20} />
          <span>Configuración</span>
        </button>
      </footer>

      {/* Tienda Modal Independiente */}
      {activeShopKid && (
        <div className="modal-overlay scrollable-modal" onClick={() => setActiveShopKid(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <button className="modal-close" onClick={() => setActiveShopKid(null)}><X size={24} /></button>
            <div className="shop-header" style={{marginBottom: '30px', textAlign: 'center'}}>
              <h2 style={{fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '10px'}}>Canje de Premios</h2>
              <h1 style={{marginBottom: '20px'}}>Tienda de {kidsState[activeShopKid].name} 🛍️</h1>
              <div className={`coin-badge-big ${activeShopKid}`}>
                <span className="badge-label">Tu Saldo Actual:</span>
                <Star size={24} fill="#FFD700" color="#FFD700" /> 
                <span className="pts-big">{kidsState[activeShopKid].points} ⭐</span>
              </div>
            </div>
            
            <div className="rewards-grid">
              {settings.rewards.map(reward => (
                <div key={reward.id} className="reward-card" onClick={() => handlePurchase(reward)}>
                  <div className="reward-emoji">{reward.emoji}</div>
                  <div className="reward-label">{reward.label}</div>
                  <div className="reward-cost">{reward.cost} ⭐</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALES */}

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
              <h3>Añadir Nuevo Reto</h3>
              <div style={{display:'flex', gap:'8px', alignItems:'stretch', marginTop:'10px', width:'100%'}}>
                <input
                  className="inline-edit-input"
                  style={{flex:1, minWidth:0, fontSize:'1rem', padding:'10px', height:'42px', boxSizing:'border-box'}}
                  placeholder="Ej: Deberes"
                  value={newTaskName}
                  onChange={e=>setNewTaskName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createCustomTask()}
                />
                <button
                  className="base-btn"
                  style={{padding:'0 14px', height:'42px', flexShrink:0, boxSizing:'border-box'}}
                  onClick={createCustomTask}
                >
                  <Plus size={18}/>
                </button>
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

            <div className="settings-section" style={{marginTop:'30px', padding:'15px', background:'rgba(226, 54, 54, 0.1)', borderRadius:'12px', border:'1px solid rgba(226, 54, 54, 0.2)'}}>
              <h3 style={{color:'#E23636'}}>Zona Admin</h3>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'10px'}}>Solo usa esto si el auto-reset diario falló o necesitas limpiar los retos a mitad del día.</p>
              <button className="base-btn reset-manual-btn" onClick={handleCloseDay} style={{width:'100%', background:'#E23636'}}>Resetear Retos Manualmente 🔄</button>
            </div>

            <button className="base-btn" onClick={() => setShowSettings(false)} style={{width:'100%', marginTop:'30px'}}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Toast Notification System */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.emoji && <span className="toast-emoji">{toast.emoji}</span>}
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Custom Confirm Modal */}
      {confirmModal.show && (
        <div className="modal-overlay" onClick={handleConfirmNo}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '340px', textAlign: 'center'}}>
            <p className="confirm-message">{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="confirm-btn confirm-cancel" onClick={handleConfirmNo}>Cancelar</button>
              <button className="confirm-btn confirm-ok" onClick={handleConfirmYes}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
