import { useState } from 'react';
import './App.css';
import Sidebar from './components/Layout/Sidebar';
import StoreManagement from './components/StoreManagement/StoreManagement';
import PaymentManagement from './components/PaymentManagement/PaymentManagement';

function App() {
  const [activeSystem, setActiveSystem] = useState('stores'); // 'stores' or 'payments'

  return (
    <div className="app-layout">
      <Sidebar activeSystem={activeSystem} setActiveSystem={setActiveSystem} />

      <main className="main-content">
        {activeSystem === 'stores' ? (
          <StoreManagement />
        ) : (
          <PaymentManagement />
        )}
      </main>
    </div>
  );
}

export default App;
