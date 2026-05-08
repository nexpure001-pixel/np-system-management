import { useState, useEffect } from 'react';
import { db } from './lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Zap, ChevronDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import './App.css';
import Sidebar from './components/Layout/Sidebar';
import StoreManagement from './components/StoreManagement/StoreManagement';
import PaymentManagement from './components/PaymentManagement/PaymentManagement';
import LeaveManagement from './components/LeaveManagement/LeaveManagement';
import CoolingOffManagement from './components/CoolingOff/CoolingOffManagement';
import ManualManagement from './components/Manual/ManualManagement';
import ProductReviewApp from './components/ProductReview/ProductReviewApp';
import ManualPortal from './components/Manual/Portal/ManualPortal';
import RequestWorkManagement from './components/RequestWork/RequestWorkManagement';
import MigrationTool from './components/Migration/MigrationTool';
import DataRefreshTool from './components/Migration/DataRefreshTool';
import ScheduleManagement from './components/Schedule/ScheduleManagement';

const MailCheckSheet = () => (
  <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <iframe
      src="/mail_check.html"
      title="送信前チェックシート"
      style={{ flex: 1, border: 'none', width: '100%' }}
    />
  </div>
);

function App() {
  const [activeSystem, setActiveSystem] = useState('stores');
  const [urgentOverdueTasks, setUrgentOverdueTasks] = useState([]);
  const [isAlertDropdownOpen, setIsAlertDropdownOpen] = useState(false);

  // 全システム共通で「スケジュール」の重要超過タスクを監視
  useEffect(() => {
    const q = query(
      collection(db, 'schedule_tasks'),
      where('completed', '==', false),
      where('isUrgent', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      let overdueTasks = [];
      snapshot.forEach(doc => {
        const t = doc.data();
        if (!t.isRepeatTemplate && t.urgentDeadline && new Date(t.urgentDeadline) < now) {
          overdueTasks.push({ id: doc.id, ...t });
        }
      });
      // 期日が古い順（超過時間が長い順）にソート
      overdueTasks.sort((a, b) => new Date(a.urgentDeadline) - new Date(b.urgentDeadline));
      setUrgentOverdueTasks(overdueTasks);
      if (overdueTasks.length === 0) {
        setIsAlertDropdownOpen(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const renderContent = () => {
    switch (activeSystem) {
      case 'stores': return <StoreManagement />;
      case 'payments': return <PaymentManagement />;
      case 'leave': return <LeaveManagement />;
      case 'cooling-off': return <CoolingOffManagement />;
      case 'product-review': return <ProductReviewApp />;
      case 'request-work': return <RequestWorkManagement />;
      case 'schedule': return <ScheduleManagement />;
      case 'mail-check': return <MailCheckSheet />;
      case 'manual': return <ManualManagement />;
      case 'manual-portal': return <ManualPortal />;
      case 'migration': return <MigrationTool />;
      case 'refresh': return <DataRefreshTool />;
      default: return <StoreManagement />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {urgentOverdueTasks.length > 0 && (
        <div style={{ position: 'relative', zIndex: 9999 }}>
          <div className="eva-alert" onClick={() => setIsAlertDropdownOpen(!isAlertDropdownOpen)} style={{ cursor: 'pointer' }}>
              <div className="eva-stripes" />
              <div className="eva-content">
                  <span className="eva-label">SYSTEM ALERT</span>
                  <Zap size={20} className="eva-icon" />
                  <span className="eva-text">WARNING：重要タスクの最終取組み日時を超過しました。直ちに確認してください。</span>
                  <span className="eva-count" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    [ {urgentOverdueTasks.length}件 超過 ] 
                    <ChevronDown size={18} style={{ transform: isAlertDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </span>
              </div>
              <div className="eva-stripes" />
          </div>
          
          {isAlertDropdownOpen && (
            <div className="eva-dropdown-menu">
              <div className="eva-dropdown-header">
                <h3>⚠️ 超過タスク一覧</h3>
                <span>クリックでスケジュール画面へ移動</span>
              </div>
              <div className="eva-dropdown-list">
                {urgentOverdueTasks.map(task => (
                  <div key={task.id} className="eva-dropdown-item" onClick={() => { setActiveSystem('schedule'); setIsAlertDropdownOpen(false); }}>
                    <div className="eva-task-title">{task.title || 'タイトルなし'}</div>
                    <div className="eva-task-meta">
                      <span className="eva-deadline"><Clock size={12} /> 期限: {task.urgentDeadline ? format(new Date(task.urgentDeadline), 'yyyy/MM/dd HH:mm') : ''}</span>
                      {task.assignee && <span className="eva-assignee">👤 {task.assignee}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className={`app-layout theme-${activeSystem}`} style={{ flex: 1, minHeight: 'auto' }}>
        <Sidebar activeSystem={activeSystem} setActiveSystem={setActiveSystem} />
        <main className={`main-content ${activeSystem === 'schedule' ? 'full-bleed' : ''}`}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
