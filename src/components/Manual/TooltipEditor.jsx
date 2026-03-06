import React from 'react';
import { Trash2, X } from 'lucide-react';

const TooltipEditor = ({ hotspot, onChange, onDelete, onClose }) => {
    if (!hotspot) return null;

    const handleChange = (field, value) => {
        onChange(hotspot.id, { [field]: value });
    };

    return (
        <div className="w-80 bg-white/60 backdrop-blur-xl border-l border-white/40 flex flex-col h-full text-slate-800 shadow-xl z-50 overflow-y-auto">
            <div className="p-4 border-b border-white/30 flex items-center justify-between bg-white/30">
                <h2 className="font-bold text-sm tracking-wide text-slate-800">ホットスポット編集</h2>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                    <X size={16} />
                </button>
            </div>

            <div className="p-6 space-y-6">
                {/* Type Selection */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">タイプ</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'required', label: '必須', class: 'bg-red-600' },
                            { id: 'caution', label: '注意', class: 'bg-amber-500' },
                            { id: 'info', label: '情報', class: 'bg-blue-500' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => handleChange('type', type.id)}
                                className={`px-2 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm ${hotspot.type === type.id
                                    ? `${type.class} text-white ring-2 ring-white ring-offset-2 ring-offset-white/50`
                                    : 'bg-white/50 text-slate-500 hover:bg-white border border-white/50'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Icon Selection */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">アイコン</label>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={hotspot.icon}
                            onChange={(e) => handleChange('icon', e.target.value)}
                            className="bg-white/50 border border-white/50 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-sm"
                            placeholder="1, 2, A, ●, !..."
                        />
                    </div>
                    <div className="flex gap-2">
                        {['1', '2', '3', '●', '!', '?'].map(char => (
                            <button
                                key={char}
                                onClick={() => handleChange('icon', char)}
                                className="w-8 h-8 rounded-lg bg-white/50 hover:bg-white text-xs font-bold flex items-center justify-center transition-colors border border-white/50 text-slate-600 shadow-sm"
                            >
                                {char}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">タイトル</label>
                        <input
                            type="text"
                            value={hotspot.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="w-full bg-white/50 border border-white/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">説明文</label>
                        <textarea
                            rows={4}
                            value={hotspot.content}
                            onChange={(e) => handleChange('content', e.target.value)}
                            className="w-full bg-white/50 border border-white/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-sm"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">HTMLタグ（&lt;strong&gt;, &lt;br&gt; 等）が使用可能です</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">注記・警告</label>
                        <textarea
                            rows={2}
                            value={hotspot.note}
                            onChange={(e) => handleChange('note', e.target.value)}
                            className="w-full bg-amber-50/50 border border-amber-200/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition-colors border-l-4 border-l-amber-500 shadow-sm"
                            placeholder="⚠ 注意書き（任意）"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-white/30">
                    <button
                        onClick={() => onDelete(hotspot.id)}
                        className="flex items-center justify-center w-full gap-2 px-4 py-2 bg-red-100/50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors text-sm font-bold border border-red-200"
                    >
                        <Trash2 size={16} />
                        削除
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TooltipEditor;
