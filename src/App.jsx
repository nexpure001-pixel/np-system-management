import { useState } from 'react';
import './App.css';
import Sidebar from './components/Layout/Sidebar';
import StoreManagement from './components/StoreManagement/StoreManagement';
import PaymentManagement from './components/PaymentManagement/PaymentManagement';
import LeaveManagement from './components/LeaveManagement/LeaveManagement';
import CoolingOffManagement from './components/CoolingOff/CoolingOffManagement';
import ManualManagement from './components/Manual/ManualManagement';

function App() {
  const [activeSystem, setActiveSystem] = useState('stores');

  const renderContent = () => {
    switch (activeSystem) {
      case 'stores': return <StoreManagement />;
      case 'payments': return <PaymentManagement />;
      case 'leave': return <LeaveManagement />;
      case 'cooling-off': return <CoolingOffManagement />;
      case 'manual': return <ManualManagement />;
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
