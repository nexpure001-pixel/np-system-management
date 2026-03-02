import React from 'react';

const Sidebar = ({ activeSystem, setActiveSystem }) => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2>NP システム</h2>
            </div>
            <nav className="system-nav">
                <button
                    className={`nav-item ${activeSystem === 'stores' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('stores')}
                >
                    <span className="nav-icon">📊</span> 店舗管理
                </button>
                <button
                    className={`nav-item ${activeSystem === 'payments' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('payments')}
                >
                    <span className="nav-icon">💰</span> 入金管理
                </button>
                <button
                    className={`nav-item ${activeSystem === 'cooling-off' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('cooling-off')}
                >
                    <span className="nav-icon">🌟</span> クーリングオフ
                </button>
                <button
                    className={`nav-item nav-bottom ${activeSystem === 'leave' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('leave')}
                >
                    <span className="nav-icon">📅</span> 有給管理
                </button>
            </nav>
        </aside>
    );
};

export default Sidebar;
