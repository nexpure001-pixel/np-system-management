import { useState } from 'react';
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
import DataRefreshTool from './components/Migration/DataRefreshTool.jsx';

// 送信前チェックシート：public フォルダの HTML を iframe で表示
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

  const renderContent = () => {
    switch (activeSystem) {
      case 'stores': return <StoreManagement />;
      case 'payments': return <PaymentManagement />;
      case 'leave': return <LeaveManagement />;
      case 'cooling-off': return <CoolingOffManagement />;
      case 'product-review': return <ProductReviewApp />;
      case 'request-work': return <RequestWorkManagement />;
      case 'mail-check': return <MailCheckSheet />;
      case 'manual': return <ManualManagement />;
      case 'manual-portal': return <ManualPortal />;
      case 'migration': return <MigrationTool />;
      case 'refresh': return <DataRefreshTool />;
      default: return <StoreManagement />;
    }
  };

  return (
    <div className={`app-layout theme-${activeSystem}`}>
      <Sidebar activeSystem={activeSystem} setActiveSystem={setActiveSystem} />

      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
