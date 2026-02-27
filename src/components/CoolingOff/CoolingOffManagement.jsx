import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
    FileUp,
    Save,
    Download,
    Trash2,
    Shield,
    BookOpen,
    X,
    Skull,
    AlertTriangle,
    CheckCircle,
    Clock
} from 'lucide-react';
import './CoolingOffManagement.css';

const TARGET_DATE_COL_NAMES = ['商品到着日', '初回商品到着日', '初回商品発送日', '契約日'];
const PULLDOWN_KEYS = ['種別', '支払方法', '申出方法', '実績月', '実施月'];

const INITIAL_PULLDOWN_OPTIONS = {
    '種別': ['', 'クーリングオフ', '90日返品ルール適用解約', '特）中途解約', '退会', '特例2ポジキャンセル', '4ポジキャンセル', '商品キャンセル', 'キャンセル'],
    '支払方法': ['', 'カード', '振込み', 'カード/振込', '口座振替', '-'],
    '実績月': ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    '実施月': ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    '申出方法': ['', 'ハガキ', '書面', 'メール', 'カスタマー', 'コンタクト', '電話', '電話・メール', '消費者センター', 'その他']
};

const CoolingOffManagement = () => {
    const [headers, setHeaders] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [isManualOpen, setIsManualOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [pulldownOptions, setPulldownOptions] = useState(INITIAL_PULLDOWN_OPTIONS);
    const [sortConfig, setSortConfig] = useState({ key: -1, direction: 'asc' });

    const idleTimerRef = useRef(null);
    const IDLE_TIMEOUT = 10 * 60 * 1000;

    // Load data from Supabase
    useEffect(() => {
        fetchData();
        resetIdleTimer();

        const events = ['mousemove', 'mousedown', 'keypress', 'touchstart'];
        events.forEach(event => window.addEventListener(event, handleActivity));

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            clearTimeout(idleTimerRef.current);
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cooling_off_records')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                setHeaders(data.headers || []);
                setTableData(data.data || []);
                updatePulldownOptions(data.headers, data.data);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveData = async (newHeaders, newData) => {
        try {
            const { error } = await supabase
                .from('cooling_off_records')
                .insert([{ headers: newHeaders, data: newData }]);

            if (error) throw error;
            setSaveStatus('保存しました 🦇');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (err) {
            console.error('Save error:', err);
            setSaveStatus('保存失敗 💀');
        }
    };

    const handleActivity = () => {
        if (!isLocked) resetIdleTimer();
    };

    const resetIdleTimer = () => {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => setIsLocked(true), IDLE_TIMEOUT);
    };

    const updatePulldownOptions = (currentHeaders, currentData) => {
        const newOptions = { ...INITIAL_PULLDOWN_OPTIONS };
        currentHeaders.forEach((h, c) => {
            if (PULLDOWN_KEYS.includes(h)) {
                const options = new Set(newOptions[h]);
                currentData.forEach(row => {
                    if (row[c]) options.add(row[c].trim());
                });
                newOptions[h] = Array.from(options);
            }
        });
        setPulldownOptions(newOptions);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split(/\r?\n/);
            if (lines.length === 0) return;

            let headerIndex = 0;
            for (let i = 0; i < Math.min(lines.length, 100); i++) {
                if (lines[i].includes('種別') || lines[i].includes('お名前')) {
                    headerIndex = i;
                    break;
                }
            }

            const rawHeaders = parseCsvLine(lines[headerIndex]);
            let lastValidCol = rawHeaders.length - 1;
            while (lastValidCol >= 0 && !rawHeaders[lastValidCol].trim()) lastValidCol--;

            let tempHeaders = rawHeaders.slice(0, lastValidCol + 1);
            let noIdx = tempHeaders.findIndex(h => h.trim() === 'No.' || h.trim() === 'No');
            let filteredHeaders = tempHeaders.filter((_, i) => i !== noIdx);

            if (!filteredHeaders.includes('入金依頼')) {
                filteredHeaders.unshift('入金依頼');
            }

            const newData = [];
            for (let i = headerIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line && !line.replace(/,/g, '').match(/^$/)) {
                    const row = parseCsvLine(line).slice(0, tempHeaders.length);
                    if (row.join('').trim().length > 0) {
                        let filteredRow = row.filter((_, idx) => idx !== noIdx);
                        if (filteredHeaders[0] === '入金依頼' && filteredRow.length < filteredHeaders.length) {
                            filteredRow.unshift(false);
                        }

                        filteredHeaders.forEach((h, c) => {
                            if (h.includes('日')) filteredRow[c] = standardizeDateStr(filteredRow[c]);
                        });
                        newData.push(filteredRow);
                    }
                }
            }

            setHeaders(filteredHeaders);
            setTableData(newData);
            updatePulldownOptions(filteredHeaders, newData);
            saveData(filteredHeaders, newData);
        };
        reader.readAsText(file);
    };

    const parseCsvLine = (text) => {
        let result = [], current = '', inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
            else current += char;
        }
        result.push(current);
        return result;
    };

    const standardizeDateStr = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
        let s = dateStr.trim();
        let parts = s.match(/(?:(\d{4})[\/\-\年])?(\d{1,2})[\/\-\月](\d{1,2})/);
        if (!parts) return s;
        let year = parts[1] ? parseInt(parts[1]) : new Date().getFullYear();
        if (year < 100) year += 2000;
        return `${year}/${String(parts[2]).padStart(2, '0')}/${String(parts[3]).padStart(2, '0')}`;
    };

    const calculateStatus = (dateStr) => {
        if (!dateStr || dateStr.trim() === '-' || dateStr.trim() === '') return 'unknown';
        let parts = dateStr.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
        if (!parts) return 'unknown';

        const arrivalDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        if (isNaN(arrivalDate.getTime())) return 'unknown';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 20) return 'cooling';
        if (diffDays <= 90) return '90days';
        return 'expired';
    };

    const updateCell = (rIdx, cIdx, value) => {
        const newData = [...tableData];
        if (headers[cIdx].includes('日') && value) {
            value = value.replace(/-/g, '/');
        }
        newData[rIdx][cIdx] = value;
        setTableData(newData);
        saveData(headers, newData);
    };

    const addNewRecord = () => {
        const newRow = Array(headers.length).fill('');
        if (headers[0] === '入金依頼') newRow[0] = false;
        const newData = [newRow, ...tableData];
        setTableData(newData);
        saveData(headers, newData);
    };

    const exportCSV = () => {
        let csvContent = '\uFEFF' + headers.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',') + '\r\n';
        tableData.forEach(row => {
            csvContent += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',') + '\r\n';
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `クーリングオフ_更新版_${format(new Date(), 'yyyyMMdd')}.csv`;
        link.click();
    };

    const exportTransferData = () => {
        const reqIdx = headers.indexOf('入金依頼');
        if (reqIdx === -1) return alert('「入金依頼」列が見つかりません');

        const targetRows = tableData.filter(row => row[reqIdx] === true || row[reqIdx] === 'true');
        if (targetRows.length === 0) return alert('入金依頼にチェックが入っているデータがありません');

        const nameIdx = headers.findIndex(h => h.includes('お名前') || h.includes('氏名'));
        const amountIdx = headers.findIndex(h => h.includes('金額'));
        const bankIdx = headers.findIndex(h => h.includes('口座') || h.includes('銀行'));

        let text = `【振込依頼データ】\n出力日時: ${new Date().toLocaleString()}\n件数: ${targetRows.length}件\n\n`;
        targetRows.forEach((row, i) => {
            text += `[${i + 1}件目]\n`;
            text += `お名前: ${row[nameIdx] || '-'}\n`;
            text += `金額: ${row[amountIdx] || '-'}\n`;
            text += `口座: ${row[bankIdx] || '-'}\n\n`;
        });

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `振込依頼_${format(new Date(), 'yyyyMMdd')}.txt`;
        link.click();
    };

    const renderCellInput = (val, rIdx, cIdx) => {
        const h = headers[cIdx];
        if (h === '入金依頼') {
            return (
                <input
                    type="checkbox"
                    checked={val === true || val === 'true'}
                    onChange={(e) => updateCell(rIdx, cIdx, e.target.checked)}
                    className="w-5 h-5 cursor-pointer"
                />
            );
        }
        if (h.includes('日')) {
            const yyyymmdd = val ? val.replace(/\//g, '-') : '';
            return (
                <input
                    type="date"
                    value={yyyymmdd}
                    onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                    className="bg-transparent border-none text-inherit w-full"
                />
            );
        }
        if (PULLDOWN_KEYS.includes(h)) {
            return (
                <select
                    value={val}
                    onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                    className="bg-transparent border-none text-inherit w-full outline-none"
                >
                    {(pulldownOptions[h] || []).map(opt => (
                        <option key={opt} value={opt} className="bg-gray-900">{opt}</option>
                    ))}
                </select>
            );
        }
        return (
            <input
                type="text"
                value={val}
                onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                className="bg-transparent border-none text-inherit w-full outline-none"
            />
        );
    };

    if (isLocked) {
        return (
            <div className="blood-overlay active" onClick={() => setIsLocked(false)}>
                <div className="locked-msg">
                    <Skull className="w-16 h-16 mx-auto mb-4 text-red-600 animate-pulse" />
                    🦇 吸血鬼が監視中...<br />
                    <span className="text-xl font-normal text-gray-400">(クリックして封印解除)</span>
                </div>
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="blood-drip"
                        style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, width: `${Math.random() * 20 + 5}px` }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="cooling-off-container bg-dracula-bg min-h-screen text-gray-100 p-6 font-serif">
            <header className="mb-8">
                <h1 className="horror-title text-5xl text-center mb-2">Cooling-Off Castle</h1>
                <p className="text-dracula-gold text-center text-xl italic mb-6">クーリングオフ・返品管理システム</p>

                <div className="flex justify-center gap-4">
                    <button onClick={() => setIsManualOpen(true)} className="btn bg-gray-800 hover:bg-gray-700">
                        <BookOpen className="w-4 h-4 mr-2" /> 使い方マニュアル
                    </button>
                    <button onClick={() => setIsLocked(true)} className="btn bg-gray-800 hover:bg-gray-700">
                        <Shield className="w-4 h-4 mr-2" /> 席をはずす
                    </button>
                </div>
            </header>

            <div className="controls bg-dracula-panel p-6 rounded-xl border border-red-900 shadow-2xl mb-8 flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-3">
                    <div className="relative">
                        <button className="btn bg-red-950 border-red-600">
                            <FileUp className="w-4 h-4 mr-2" /> CSV読込
                        </button>
                        <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept=".csv" />
                    </div>
                    <button onClick={exportCSV} className="btn bg-red-900 border-red-600">
                        <Save className="w-4 h-4 mr-2" /> 保存 (CSV)
                    </button>
                    <button onClick={exportTransferData} className="btn bg-green-950 border-green-600 text-green-400">
                        <Download className="w-4 h-4 mr-2" /> 振込データ出力
                    </button>
                </div>

                <div className="flex gap-6 items-center">
                    <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_green]" /> クーリングオフ
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_8px_yellow]" /> 90日経過
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_red]" /> 期限切れ
                        </div>
                    </div>
                    <button
                        onClick={() => { if (confirm('データをクリアしますか？')) { setTableData([]); setHeaders([]); saveData([], []); } }}
                        className="text-gray-500 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="table-container bg-black/40 backdrop-blur-md rounded-xl border border-red-950 overflow-auto max-h-[70vh]">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-red-950/40 text-dracula-gold sticky top-0 z-10 box-decoration-clone">
                            <th className="p-4 border-b border-red-900">判定</th>
                            {headers.map((h, i) => (
                                <th key={i} className="p-4 border-b border-red-900 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white/5 border-b border-red-900/30">
                            <td className="p-4"><Skull className="w-5 h-5 text-gray-700" /></td>
                            {headers.map((_, i) => (
                                <td key={i} className="p-2">
                                    {i === headers.length - 1 ? (
                                        <div className="flex items-center gap-2">
                                            <input type="text" placeholder="新規入力..." className="bg-black/40 border border-gray-800 p-2 rounded w-full" />
                                            <button onClick={addNewRecord} className="bg-red-900 p-2 rounded hover:bg-red-700 transition-colors">
                                                追加
                                            </button>
                                        </div>
                                    ) : (
                                        <input type="text" placeholder="..." className="bg-black/40 border border-gray-800 p-2 rounded w-full" />
                                    )}
                                </td>
                            ))}
                        </tr>
                        {tableData.map((row, rIdx) => {
                            const arrivalDateIdx = headers.findIndex(h => TARGET_DATE_COL_NAMES.includes(h));
                            const status = arrivalDateIdx !== -1 ? calculateStatus(row[arrivalDateIdx]) : 'unknown';
                            const isCard = row.some(cell => cell?.toString().includes('カード'));

                            return (
                                <tr key={rIdx} className={`border-b border-red-900/20 hover:bg-white/5 transition-colors ${isCard ? 'bg-red-900/10' : ''}`}>
                                    <td className="p-4">
                                        {status === 'cooling' && <span className="status-badge status-cooling">🦇20日以内</span>}
                                        {status === '90days' && <span className="status-badge status-90">🕸️90日超過</span>}
                                        {status === 'expired' && <span className="status-badge status-expired">💀期限切れ</span>}
                                        {status === 'unknown' && <span className="text-gray-600">--</span>}
                                    </td>
                                    {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-4 min-w-[120px]">
                                            {renderCellInput(cell, rIdx, cIdx)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {saveStatus && (
                <div className="fixed top-24 right-10 bg-dracula-gold text-black px-4 py-2 rounded-lg font-bold shadow-2xl animate-bounce">
                    {saveStatus}
                </div>
            )}

            {isManualOpen && (
                <div className="modal-overlay active flex items-center justify-center bg-black/80 fixed inset-0 z-[1000]" onClick={() => setIsManualOpen(false)}>
                    <div className="modal-content bg-dracula-panel border-2 border-red-900 p-8 rounded-2xl max-w-2xl text-gray-200 relative m-4" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setIsManualOpen(false)} className="absolute top-4 right-4 text-dracula-gold hover:text-red-500">
                            <X className="w-8 h-8" />
                        </button>
                        <h2 className="text-3xl horror-title text-red-600 mb-6 border-b border-red-900 pb-2">使い方マニュアル</h2>
                        <div className="space-y-4 max-h-[60vh] overflow-auto pr-4 custom-scrollbar">
                            <section>
                                <h3 className="text-dracula-gold font-bold text-lg mb-2">1. データの読み込み</h3>
                                <p>「CSV読込」から管理用CSVを選択します。データは自動的にSupabaseへ保存されます。</p>
                            </section>
                            <section>
                                <h3 className="text-dracula-gold font-bold text-lg mb-2">2. 状態の自動判定</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><span className="text-green-400">🦇20日以内</span>: クーリングオフ期間中</li>
                                    <li><span className="text-yellow-400">🕸️90日超過</span>: 90日返品ルールの対象</li>
                                    <li><span className="text-red-400">💀期限切れ</span>: 返品・解除期間外</li>
                                </ul>
                            </section>
                            <section>
                                <h3 className="text-dracula-gold font-bold text-lg mb-2">3. 振込データ出力</h3>
                                <p>「入金依頼」にチェックを入れた顧客の情報を、送金用のテキスト形式でまとめてダウンロードできます。</p>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoolingOffManagement;
