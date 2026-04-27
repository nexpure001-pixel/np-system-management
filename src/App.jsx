import { useState, useEffect } from 'react';
import { db } from './lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Zap } from 'lucide-react';
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
  const [urgentOverdueCount, setUrgentOverdueCount] = useState(0);

  // 全システム共通で「スケジュール」の重要超過タスクを監視
  useEffect(() => {
    const q = query(
      collection(db, 'schedule_tasks'),
      where('completed', '==', false),
      where('isUrgent', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      let count = 0;
      snapshot.forEach(doc => {
        const t = doc.data();
        if (t.urgentDeadline && new Date(t.urgentDeadline) < now) {
          count++;
        }
      });
      setUrgentOverdueCount(count);
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
      {urgentOverdueCount > 0 && (
        <div className="eva-alert">
            <div className="eva-stripes" />
            <div className="eva-content">
                <span className="eva-label">SYSTEM ALERT</span>
                <Zap size={20} className="eva-icon" />
                <span className="eva-text">WARNING：重要タスクの最終取組み日時を超過しました。直ちに確認してください。</span>
                <span className="eva-count">[ {urgentOverdueCount}件 超過 ]</span>
            </div>
            <div className="eva-stripes" />
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
