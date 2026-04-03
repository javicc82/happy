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
    { id: 'park', label: 'Salir al parque', emoji: '🛝', cost: 5 },
    { id: 'story', label: 'Cuento extra', emoji: '📖', cost: 8 },
    { id: 'soccer', label: 'Fútbol / Deporte', emoji: '⚽', cost: 10 },
    { id: 'icecream', label: 'Ir a por un Helado', emoji: '🍦', cost: 15 },
    { id: 'dinner', label: 'Elegir la cena', emoji: '🍕', cost: 20 },
    { id: 'boardgame', label: 'Juego de mesa', emoji: '🎲', cost: 25 }
  ]
};

const INITIAL_STATE = {
  "1700000000000": {
    name: 'Martín',
    theme: 'pikachu',
    avatar: '/avatar_pikachu.png',
    tasks: { fruit: [], teeth: false, hands: false, toys: false, eat: false, dress: false },
    points: 0
  },
  "1700000000001": {
    name: 'Nacho',
    theme: 'spiderman',
    avatar: '/avatar_spiderman.png',
    tasks: { fruit: [], teeth: false, hands: false, toys: false, eat: false, dress: false },
    points: 0
  }
};

export default function App() {
  const [kidsState, setKidsState] = useState(() => {
    const saved = localStorage.getItem('happyApp_state_v7');
    if (saved) return JSON.parse(saved);
    return INITIAL_STATE;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('happyApp_settings_v7');
    if (saved) return JSON.parse(saved);
    return INITIAL_APP_SETTINGS;
  });

  // UI Modals & Navigation
  const [activeTab, setActiveTab] = useState(() => Object.keys(kidsState)[0] || null);
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

  // Editor de Niños
  const [kidEditor, setKidEditor] = useState({ show: false, kidId: null, name: '', theme: '', avatar: '' });

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
        // Ejecutar reset automático para todos los niños
        setKidsState(prev => {
          const newState = {...prev};
          Object.keys(newState).forEach(kidId => {
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

  const allStats = Object.keys(kidsState).map(id => getKidProgressStats(id));
  const totalScore = allStats.reduce((acc, s) => acc + s.score, 0);
  const totalPossible = allStats.reduce((acc, s) => acc + s.total, 0);
  const teamPercentage = totalPossible === 0 ? 0 : (totalScore / totalPossible) * 100;

  useEffect(() => {
    if (totalScore === totalPossible && totalPossible > 0) {
      triggerConfetti(['#FFD700', '#E23636', '#22c55e']);
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
        Object.keys(newState).forEach(kidId => {
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
  // --- Lógica Niños ---
  const saveKidProfile = () => {
    if (!kidEditor.name.trim()) return showToast('El nombre es obligatorio', 'error');
    
    setKidsState(prev => {
      const id = kidEditor.kidId || Date.now().toString();
      const isNew = !kidEditor.kidId;
      
      const newKid = {
        name: kidEditor.name,
        theme: kidEditor.theme || 'pikachu',
        avatar: kidEditor.avatar || '/avatar_pikachu.png',
        points: isNew ? 0 : prev[id].points,
        tasks: isNew ? { fruit: [] } : prev[id].tasks
      };

      if (isNew) {
        COMBINED_TASKS.forEach(t => { if(t.id !== 'fruit') newKid.tasks[t.id] = false; });
      }

      const newState = { ...prev, [id]: newKid };
      if (isNew && !activeTab) setActiveTab(id);
      return newState;
    });
    
    setKidEditor({ show: false, kidId: null, name: '', theme: '', avatar: '' });
    showToast('Perfil actualizado', 'success');
  };

  const deleteKid = (id) => {
    showConfirm(`¿Eliminar a ${kidsState[id].name}? Se borrarán sus puntos.`, () => {
      setKidsState(prev => {
        const newState = { ...prev };
        delete newState[id];
        const remainingKeys = Object.keys(newState);
        if (activeTab === id) setActiveTab(remainingKeys[0] || null);
        return newState;
      });
      showToast('Niño eliminado', 'info');
    });
  };

  const handlePinSubmit = () => {
    if (pinInput === '1234') {
      setShowPinModal(false); setPinInput(''); setShowSettings(true);
    } else {
      showToast('PIN incorrecto.', 'error', '🔒');
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
    if (!kid) return null;

    return (
      <button 
        className={`tab-btn ${activeTab === kidId ? (kid.theme==='pikachu'?'active-pika':'active-spidey') : ''}`} 
        onClick={() => setActiveTab(kidId)}
      >
        <img src={kid.avatar} alt={kid.name} />
        <span>{kid.name}</span>
      </button>
    );
  };

  // --- Componentes UI Locales ---
  const KidProfile = ({ kidId }) => {
    const kid = kidsState[kidId];
    if (!kid) return null;
    const stats = getKidProgressStats(kidId);
    const percent = stats.total === 0 ? 0 : stats.score / stats.total;
    let faceIndex = 0;
    if (percent > 0) faceIndex = 1; if (percent >= 0.5) faceIndex = 2; if (percent >= 0.75) faceIndex = 3; if (percent >= 1) faceIndex = 4;
    const currentFace = PROGRESS_FACES[faceIndex];
    
    return (
      <div className={`kid-card ${kid.theme}`}>
        <div className="kid-identity" style={{justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{display:'flex', gap:'12px', alignItems:'center', maxWidth: '70%'}}>
            <img src={kid.avatar} alt={kid.name} className="kid-avatar" />
            <div className="kid-name">{kid.name}</div>
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
        {Object.keys(kidsState).map(kidId => (
          <KidNameTab key={kidId} kidId={kidId} />
        ))}
      </div>

      <div className="kids-grid" data-active-tab={activeTab}>
        {Object.keys(kidsState).map(kidId => (
          <KidProfile key={kidId} kidId={kidId} />
        ))}
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

      {/* Selector de Fruta */}
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

      {/* PIN Padres */}
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

      {/* Configuración Completa */}
      {showSettings && (
        <div className="modal-overlay scrollable-modal" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '500px', maxHeight:'90vh', overflowY:'auto'}}>
            <button className="modal-close" onClick={() => setShowSettings(false)}><X size={24} /></button>
            <h2 style={{borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:'15px', marginBottom:'20px'}}>⚙️ Ajustes de Familia</h2>
            
            <section className="settings-section">
              <h3>Niños</h3>
              <div className="settings-kids-list" style={{marginTop:'10px'}}>
                {Object.keys(kidsState).map(kidId => (
                  <div key={kidId} className="settings-kid-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', background:'rgba(255,255,255,0.05)', borderRadius:'12px', marginBottom:'8px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                      <img src={kidsState[kidId].avatar} width="40" height="40" style={{borderRadius:'50%', border:'2px solid var(--glass-border)'}} alt={kidsState[kidId].name} />
                      <span style={{fontWeight:'700'}}>{kidsState[kidId].name}</span>
                    </div>
                    <div style={{display:'flex', gap:'8px'}}>
                      <button className="icon-btn" onClick={() => setKidEditor({ show: true, kidId, name: kidsState[kidId].name, theme: kidsState[kidId].theme, avatar: kidsState[kidId].avatar })}>✏️</button>
                      <button className="icon-btn" onClick={() => deleteKid(kidId)} style={{color:'#E23636'}}><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="base-btn secondary" onClick={() => setKidEditor({ show: true, kidId: null, name: '', theme: 'pikachu', avatar: '/avatar_pikachu.png' })} style={{width:'100%', marginTop:'10px'}}>
                <Plus size={16} /> Añadir otro niño
              </button>
            </section>

            <section className="settings-section" style={{marginTop:'30px'}}>
              <h3>Retos Activos Hoy</h3>
              {COMBINED_TASKS.map(t => (
                <div key={t.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom: '10px'}}>
                  <label className="setting-toggle" style={{flex: 1, margin: 0}}>
                    <input type="checkbox" checked={settings.enabledTasks.includes(t.id)} onChange={() => toggleSettingTask(t.id)} />
                    <span>{t.custom && t.emoji} {t.label} </span>
                  </label>
                </div>
              ))}
            </section>

            <section className="settings-section" style={{marginTop:'30px', padding:'15px', background:'rgba(226, 54, 54, 0.1)', borderRadius:'12px', border:'1px solid rgba(226, 54, 54, 0.2)'}}>
              <h3 style={{color:'#E23636'}}>Zona de Peligro</h3>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'10px'}}>Reinicia todos los retos de hoy manualmente.</p>
              <button className="base-btn" onClick={handleCloseDay} style={{width:'100%', background:'#E23636'}}>Resetear Retos 🔄</button>
            </section>

            <button className="base-btn" onClick={() => setShowSettings(false)} style={{width:'100%', marginTop:'30px'}}>Cerrar Ajustes</button>
          </div>
        </div>
      )}

      {/* Editor de Perfil de Niño */}
      {kidEditor.show && (
        <div className="modal-overlay" style={{zIndex: 2500}} onClick={() => setKidEditor({ show: false, kidId: null, name: '', theme: '', avatar: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setKidEditor({ show: false, kidId: null, name: '', theme: '', avatar: '' })}><X size={24} /></button>
            <h2>{kidEditor.kidId ? 'Editar Perfil' : 'Nuevo Niño'}</h2>
            
            <div style={{marginTop:'20px'}}>
              <label style={{display:'block', marginBottom:'8px', fontSize:'0.9rem', color:'var(--text-muted)'}}>Nombre del niño:</label>
              <input value={kidEditor.name} onChange={e => setKidEditor({...kidEditor, name: e.target.value})} className="base-input" placeholder="Ej. Martín" autoFocus />
            </div>

            <div style={{marginTop:'20px'}}>
              <label style={{display:'block', marginBottom:'8px', fontSize:'0.9rem', color:'var(--text-muted)'}}>Tema Visual:</label>
              <div style={{display:'flex', gap:'10px'}}>
                <button className={`theme-sel pika ${kidEditor.theme==='pikachu'?'active':''}`} onClick={() => setKidEditor({...kidEditor, theme: 'pikachu', avatar: '/avatar_pikachu.png'})}>Pikachu (Amarillo)</button>
                <button className={`theme-sel spidey ${kidEditor.theme==='spiderman'?'active':''}`} onClick={() => setKidEditor({...kidEditor, theme: 'spiderman', avatar: '/avatar_spiderman.png'})}>Spiderman (Rojo)</button>
              </div>
            </div>

            <button className="base-btn" onClick={saveKidProfile} style={{width:'100%', marginTop:'25px'}}>Guardar Cambios</button>
          </div>
        </div>
      )}

      {/* Confirmación Común */}
      {confirmModal.show && (
        <div className="modal-overlay" style={{zIndex: 3000}}>
          <div className="modal-content" style={{textAlign:'center', maxWidth:'340px'}}>
            <h2 style={{marginBottom:'20px'}}>{confirmModal.message}</h2>
            <div style={{display:'flex', gap:'10px'}}>
              <button className="base-btn secondary" style={{flex:1}} onClick={() => setConfirmModal({show:false})}>Cancelar</button>
              <button className="base-btn" style={{flex:1, background:'#E23636'}} onClick={() => { confirmModal.onConfirm(); setConfirmModal({show:false}); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.emoji && <span className="toast-emoji">{toast.emoji}</span>}
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
