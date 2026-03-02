import React, { useState } from 'react';
import { Download, Eye, Layout, Settings, Save, Link as LinkIcon } from 'lucide-react';
import EditorCanvas from './components/EditorCanvas';
import TooltipEditor from './components/TooltipEditor';
import LinkEditor from './components/LinkEditor'; // Import LinkEditor
import { generateDownload } from './utils/export';

function App() {
    const [imageSrc, setImageSrc] = useState(null);
    const [hotspots, setHotspots] = useState([]);
    const [links, setLinks] = useState([]); // New state for links
    const [selectedHotspotId, setSelectedHotspotId] = useState(null);
    const [selectedLinkId, setSelectedLinkId] = useState(null); // New state for selected link
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    // Stats
    const selectedHotspot = hotspots.find(h => h.id === selectedHotspotId);
    const selectedLink = links.find(l => l.id === selectedLinkId);

    // --- Hotspot Handlers ---
    const handleAddHotspot = ({ x, y }) => {
        // Deselect link if selecting hotspot
        if (selectedLinkId) setSelectedLinkId(null);

        const newId = crypto.randomUUID();
        const nextNumber = hotspots.length + 1;

        const newHotspot = {
            id: newId,
            x,
            y,
            type: 'info', // default
            icon: nextNumber.toString(),
            title: '新規項目',
            content: '説明文を入力してください...',
            note: ''
        };

        setHotspots([...hotspots, newHotspot]);
        setSelectedHotspotId(newId);
    };

    const handleUpdateHotspot = (id, updates) => {
        setHotspots(hotspots.map(h =>
            h.id === id ? { ...h, ...updates } : h
        ));
    };

    const handleDeleteHotspot = (id) => {
        setHotspots(hotspots.filter(h => h.id !== id));
        if (selectedHotspotId === id) setSelectedHotspotId(null);
    };

    // --- Link Handlers ---
    const handleAddLink = () => {
        if (!imageSrc) {
            alert('まず画像をアップロードしてください。');
            return;
        }

        const newId = crypto.randomUUID();
        const newLink = {
            id: newId,
            x: 50, // Center by default
            y: 50,
            label: '次のページへ',
            url: '#'
        };

        setLinks([...links, newLink]);
        setSelectedLinkId(newId);
        setSelectedHotspotId(null); // Deselect hotspot
    };

    const handleUpdateLink = (id, updates) => {
        setLinks(links.map(l =>
            l.id === id ? { ...l, ...updates } : l
        ));
    };

    const handleDeleteLink = (id) => {
        setLinks(links.filter(l => l.id !== id));
        if (selectedLinkId === id) setSelectedLinkId(null);
    };

    const handleSelectHotspot = (id) => {
        setSelectedHotspotId(id);
        setSelectedLinkId(null);
    };

    const handleSelectLink = (id) => {
        setSelectedLinkId(id);
        setSelectedHotspotId(null);
    };

    const handleSaveProject = () => {
        const projectData = {
            version: '1.1.0',
            imageSrc,
            hotspots,
            links
        };
        const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'manual-project.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportHtml = () => {
        if (!imageSrc) {
            alert('画像をアップロードしてください。');
            return;
        }
        generateDownload(imageSrc, hotspots, links);
    };

    const handleLoadProject = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.imageSrc) setImageSrc(data.imageSrc);
                if (data.hotspots) setHotspots(data.hotspots);
                if (data.links) setLinks(data.links);
            } catch (err) {
                alert('プロジェクトファイルの読み込みに失敗しました。');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input to allow reloading the same file
    }

    return (
        <div className="flex h-screen w-full overflow-hidden font-sans relative">
            {/* Sidebar / Toolbar (Floating Glass) */}
            <div className="absolute left-6 top-6 bottom-6 w-20 rounded-3xl bg-white/30 backdrop-blur-md border border-white/40 shadow-xl flex flex-col items-center py-6 gap-6 z-50">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
                    <Layout className="text-white" size={20} />
                </div>

                {/* Add Link Button */}
                <button
                    onClick={handleAddLink}
                    className="p-3 text-slate-600 hover:text-indigo-600 hover:bg-white/50 rounded-xl transition-all"
                    title="リンクボタンを追加"
                >
                    <LinkIcon size={20} />
                </button>

                <div className="h-px w-8 bg-slate-300/50 my-2"></div>

                <button
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className={`p-3 rounded-xl transition-all ${isPreviewMode ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600 hover:text-indigo-600 hover:bg-white/50'}`}
                    title="プレビューモード"
                >
                    <Eye size={20} />
                </button>

                <div className="flex-1" />
                <div className="flex-1" />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden pl-32 pr-6 py-6">
                {/* Top Bar (Floating Glass) */}
                <header className="h-16 rounded-2xl bg-white/30 backdrop-blur-md border border-white/40 shadow-lg flex items-center justify-between px-6 flex-shrink-0 mb-6">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold tracking-tight text-slate-800 text-lg">Manual Forge</h1>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 text-slate-600 border border-white/50 font-medium shadow-sm">v1.1.0</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-white/50 rounded-xl transition-all cursor-pointer backdrop-blur-sm shadow-sm border border-white/30">
                            <Settings size={14} />
                            読込 (JSON)
                            <input type="file" className="hidden" accept=".json" onChange={handleLoadProject} />
                        </label>
                        <button
                            onClick={handleSaveProject}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-white/50 rounded-xl transition-all shadow-sm border border-white/30"
                        >
                            <Save size={14} />
                            保存 (JSON)
                        </button>
                        <button
                            onClick={handleExportHtml}
                            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl shadow-lg shadow-indigo-500/30 transition-all border border-white/20"
                        >
                            <Download size={14} />
                            HTML書出
                        </button>
                    </div>
                </header>

                {/* Canvas Area (Glass Frame) */}
                <div className="flex-1 flex overflow-hidden rounded-2xl bg-white/40 backdrop-blur-sm border border-white/40 shadow-inner relative">
                    <EditorCanvas
                        imageSrc={imageSrc}
                        onImageUpload={setImageSrc}
                        hotspots={hotspots}
                        selectedHotspotId={selectedHotspotId}
                        onAddHotspot={handleAddHotspot}
                        onSelectHotspot={handleSelectHotspot}
                        onUpdateHotspotPosition={(id, pos) => handleUpdateHotspot(id, pos)}

                        links={links}
                        selectedLinkId={selectedLinkId}
                        onSelectLink={handleSelectLink}
                        onUpdateLinkPosition={handleUpdateLink}

                        isPreviewMode={isPreviewMode}
                    />

                    {/* Right Sidebar (Properties) */}
                    {selectedHotspot && !isPreviewMode && (
                        <TooltipEditor
                            hotspot={selectedHotspot}
                            onChange={handleUpdateHotspot}
                            onDelete={handleDeleteHotspot}
                            onClose={() => setSelectedHotspotId(null)}
                        />
                    )}

                    {selectedLink && !isPreviewMode && (
                        <LinkEditor
                            link={selectedLink}
                            onChange={handleUpdateLink}
                            onDelete={handleDeleteLink}
                            onClose={() => setSelectedLinkId(null)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
