import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, FileText, ChevronLeft, BookOpen, LayoutTemplate, ShieldAlert } from 'lucide-react';
import './PortalTheme.css';

const ManualPortal = () => {
    const [pages, setPages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activePageId, setActivePageId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTip, setActiveTip] = useState(null);

    useEffect(() => {
        const loadManuals = async () => {
            setIsLoading(true);
            const manualFiles = [
                { filename: 'manualのmanual01.html', title: '1. トップメニュー（書類作成）' },
                { filename: 'manualのmanual02.html', title: '2. 顧客基本情報入力' },
                { filename: 'manualのmanual03.html', title: '3. 決済先情報入力' }
            ];

            const parsedPages = [];

            for (let i = 0; i < manualFiles.length; i++) {
                try {
                    const response = await fetch(`/manual/${manualFiles[i].filename}`);
                    if (!response.ok) continue;
                    
                    const htmlText = await response.text();
                    
                    // Simple parsing using DOMParser
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');

                    const imgEl = doc.querySelector('.img-wrap img');
                    const imageSrc = imgEl ? imgEl.getAttribute('src') : '';

                    const hotspotEls = doc.querySelectorAll('.hs');
                    const hotspots = Array.from(hotspotEls).map((hs, index) => {
                        const style = hs.getAttribute('style') || '';
                        const leftMatch = style.match(/left:\s*([\d.]+)%/);
                        const topMatch = style.match(/top:\s*([\d.]+)%/);
                        const x = leftMatch ? parseFloat(leftMatch[1]) : 50;
                        const y = topMatch ? parseFloat(topMatch[1]) : 50;

                        const type = hs.classList.contains('type-required') ? 'required' 
                                   : hs.classList.contains('type-caution') ? 'caution' : 'info';
                        
                        const dotEl = hs.querySelector('.hs-dot');
                        const icon = dotEl ? dotEl.textContent : '?';

                        const titleEl = hs.querySelector('.tip-title');
                        const bodyEl = hs.querySelector('.tip-body');
                        const noteEl = hs.querySelector('.tip-note');

                        return {
                            id: `hs-${i}-${index}`,
                            type, x, y, icon,
                            title: titleEl ? titleEl.textContent.trim() : '',
                            content: bodyEl ? bodyEl.innerHTML.trim() : '',
                            note: noteEl ? noteEl.textContent.trim() : ''
                        };
                    });

                    parsedPages.push({
                        id: `page-${i+1}`,
                        title: manualFiles[i].title,
                        imageSrc,
                        hotspots
                    });
                } catch (e) {
                    console.error('Failed to load manual:', manualFiles[i].filename, e);
                }
            }

            setPages(parsedPages);
            if (parsedPages.length > 0) setActivePageId(parsedPages[0].id);
            setIsLoading(false);
        };

        loadManuals();
    }, []);

    const activePage = pages.find(p => p.id === activePageId);
    const currentIndex = pages.findIndex(p => p.id === activePageId);
    const progressPercent = pages.length > 0 ? ((currentIndex + 1) / pages.length) * 100 : 0;

    const handleNext = () => {
        if (currentIndex < pages.length - 1) setActivePageId(pages[currentIndex + 1].id);
    };

    const handlePrev = () => {
        if (currentIndex > 0) setActivePageId(pages[currentIndex - 1].id);
    };

    const filteredPages = pages.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (isLoading) {
        return <div className="portal-layout flex items-center justify-center h-full">読み込み中...</div>;
    }

    return (
        <div className="portal-layout">
            <aside className="portal-sidebar">
                <div className="portal-brand">
                    <BookOpen size={24} className="text-blue-500" />
                    <h2>ドキュメントハブ</h2>
                </div>
                
                <div className="portal-search">
                    <Search size={16} />
                    <input 
                        type="text" 
                        placeholder="マニュアルを検索..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="portal-nav">
                    <div className="nav-group">
                        <h3>基本マニュアル</h3>
                        {filteredPages.map(page => (
                            <button 
                                key={page.id}
                                className={`nav-item ${activePageId === page.id ? 'active' : ''}`}
                                onClick={() => setActivePageId(page.id)}
                            >
                                <FileText size={16} />
                                <span className="truncate">{page.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            <main className="portal-content">
                {activePage ? (
                    <>
                        <header className="content-header">
                            <div className="breadcrumbs">
                                <span>ドキュメント</span> <ChevronRight size={14} />
                                <span>基本マニュアル</span> <ChevronRight size={14} />
                                <span className="current">{activePage.title}</span>
                            </div>
                            <h1 className="flex items-center gap-3">
                                {activePage.title}
                            </h1>
                            <div className="progress-bar-container mt-4">
                                <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </header>

                        <div className="content-body">
                            <div className="viewer-canvas">
                                {/* Important warning section */}
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left flex gap-3 items-start">
                                    <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <h4 className="font-bold text-amber-800 text-sm mb-1">【重要】サービスマニュアルについて</h4>
                                        <p className="text-amber-700 text-xs">
                                             サービスマニュアルは別フォルダで管理されているため、この基本マニュアル群には含まれていません。
                                        </p>
                                    </div>
                                </div>

                                <div className="img-wrap">
                                    <img src={activePage.imageSrc} alt={activePage.title} />
                                    {activePage.hotspots && activePage.hotspots.map(hs => (
                                        <div 
                                            key={hs.id} 
                                            className={`hs type-${hs.type} ${activeTip === hs.id ? 'active' : ''}`}
                                            style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                                            onMouseEnter={() => setActiveTip(hs.id)}
                                            onMouseLeave={() => setActiveTip(null)}
                                        >
                                            <div className="hs-ring"></div>
                                            <div className="hs-ring hs-ring2"></div>
                                            <div className="hs-dot">{hs.icon || ''}</div>
                                            
                                            <div className={`tip ${activeTip === hs.id ? 'show' : ''}`}>
                                                <span className={`tip-tag tag-${hs.type}`}>
                                                    {hs.type === 'required' ? '必須・重要' : hs.type === 'caution' ? '注意事項' : '操作説明'}
                                                </span>
                                                <div className="tip-title">{hs.title}</div>
                                                <div className="tip-body" dangerouslySetInnerHTML={{ __html: hs.content }}></div>
                                                {hs.note && <div className="tip-note">{hs.note}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Navigation Footer */}
                        <footer className="content-footer">
                            <button 
                                className="nav-btn prev" 
                                onClick={handlePrev} 
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft size={20} />
                                <div>
                                    <div className="label">前へ</div>
                                    <div className="title">{currentIndex > 0 ? pages[currentIndex-1].title : '-'}</div>
                                </div>
                            </button>

                            <button 
                                className="nav-btn next" 
                                onClick={handleNext} 
                                disabled={currentIndex === pages.length - 1}
                            >
                                <div>
                                    <div className="label">次へ</div>
                                    <div className="title">{currentIndex < pages.length - 1 ? pages[currentIndex+1].title : '-'}</div>
                                </div>
                                <ChevronRight size={20} />
                            </button>
                        </footer>
                    </>
                ) : (
                    <div className="empty-state">
                        <LayoutTemplate size={48} className="text-gray-300 mb-4" />
                        <h2>データが見つかりません</h2>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ManualPortal;
