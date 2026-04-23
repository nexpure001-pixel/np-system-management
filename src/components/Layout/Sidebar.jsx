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
                    className={`nav-item ${activeSystem === 'product-review' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('product-review')}
                >
                    <span className="nav-icon">🎀</span> 商品審査
                </button>
                <button
                    className={`nav-item ${activeSystem === 'request-work' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('request-work')}
                >
                    <span className="nav-icon">📋</span> 依頼業務
                </button>
                <button
                    className={`nav-item ${activeSystem === 'schedule' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('schedule')}
                >
                    <span className="nav-icon">🗓️</span> スケジュール
                </button>
                <button
                    className={`nav-item ${activeSystem === 'mail-check' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('mail-check')}
                >
                    <span className="nav-icon">✅</span> 送信前チェックシート
                </button>
                <button
                    className={`nav-item nav-bottom ${activeSystem === 'manual' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('manual')}
                >
                    <span className="nav-icon">📖</span> マニュアル
                </button>
                <button
                    className={`nav-item ${activeSystem === 'manual-portal' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('manual-portal')}
                >
                    <span className="nav-icon">📚</span> マニュアルポータル
                </button>
                <button
                    className={`nav-item ${activeSystem === 'leave' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('leave')}
                >
                    <span className="nav-icon">📅</span> 有給管理
                </button>
                <div style={{ height: '1px', background: '#eee', margin: '10px 0' }}></div>
                <button
                    className={`nav-item ${activeSystem === 'migration' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('migration')}
                    style={{ color: '#6366f1' }}
                >
                    <span className="nav-icon">🔄</span> データ移行
                </button>
                <button
                    className={`nav-item ${activeSystem === 'refresh' ? 'active' : ''}`}
                    onClick={() => setActiveSystem('refresh')}
                    style={{ color: '#6366f1' }}
                >
                    <span className="nav-icon">🗄️</span> データ刷新
                </button>
            </nav>
        </aside>
    );
};

export default Sidebar;
