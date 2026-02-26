import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import './PaymentManagement.css';

const PaymentManagement = () => {
    // --- State ---
    const [payments, setPayments] = useState(() => {
        const savedData = localStorage.getItem('np_payments_data');
        if (savedData) {
            try {
                return JSON.parse(savedData);
            } catch (e) {
                console.error('PaymentManagement: Failed to parse saved data', e);
                return [];
            }
        }
        return [];
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        shiharaibi: '',
        boxIdou: '',
        touroku: '',
        soshikizu: '',
        rankUp: '',
        chuumonbi: '',
        shimei: '',
        nyuukin: '',
        bikou: ''
    });
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 100;
    const fileInputRef = useRef(null);

    // Quick Add State
    const [quickAdd, setQuickAdd] = useState({
        shiharaibi: false,
        boxIdou: false,
        touroku: '',
        soshikizu: false,
        rankUp: '',
        chuumonbi: new Date().toISOString().split('T')[0],
        shimei: '',
        nyuukin: '',
        bikou: ''
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);

    // Reset to page 1 when filters or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters]);

    // --- Lifecycle: Save to LocalStorage ---
    useEffect(() => {
        localStorage.setItem('np_payments_data', JSON.stringify(payments));
    }, [payments]);

    // --- Handlers ---
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (jsonData.length <= 1) {
                    alert('有効なデータが見つかりませんでした。');
                    return;
                }

                // Skip header row
                const rows = jsonData.slice(1);
                const importedPayments = rows.map((row, index) => ({
                    id: Date.now() + index,
                    shiharaibi: row[0] === '済' || row[0] === true || row[0] === 'TRUE',
                    boxIdou: row[1] === '済' || row[1] === true || row[1] === 'TRUE',
                    touroku: row[2] || '',
                    soshikizu: row[3] === '済' || row[3] === true || row[3] === 'TRUE',
                    rankUp: row[4] || '',
                    chuumonbi: row[5] || '',
                    shimei: row[6] || '',
                    nyuukin: String(row[7] || '').replace(/[^\d.-]/g, ''),
                    bikou: row[8] || '',
                    kanryou: row[9] === '完了' || row[9] === '済' || row[9] === true || row[9] === 'TRUE'
                })).filter(p => p.shimei || p.nyuukin);

                if (window.confirm(`${importedPayments.length}件のデータをインポートしますか？既存のデータに追加されます。`)) {
                    setPayments(prev => [...importedPayments, ...prev]);
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('インポートに失敗しました。ファイル形式を確認してください。');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleQuickAdd = () => {
        if (!quickAdd.shimei && !quickAdd.nyuukin) return;

        const newRecord = {
            ...quickAdd,
            id: Date.now(),
            kanryou: false,
            // Format amount as number if possible
            nyuukin: quickAdd.nyuukin.replace(/,/g, '')
        };

        setPayments([newRecord, ...payments]);
        // Reset fields except date and some status
        setQuickAdd(prev => ({
            ...prev,
            shiharaibi: false,
            boxIdou: false,
            touroku: '',
            soshikizu: false,
            rankUp: '',
            shimei: '',
            nyuukin: '',
            bikou: ''
        }));
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleKanryou = (id) => {
        setPayments(payments.map(p =>
            p.id === id ? { ...p, kanryou: !p.kanryou } : p
        ));
    };

    const handleInlineEdit = (id, field, value) => {
        setPayments(payments.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    const handleExportExcel = () => {
        const header = ["支払日入力", "BOX移動", "登録情報", "組織図確認", "ランクアップ", "振込日", "氏名", "入金金額", "備考", "完了"];
        const data = payments.map(p => [
            p.shiharaibi ? '済' : '未',
            p.boxIdou ? '済' : '未',
            p.touroku,
            p.soshikizu ? '済' : '未',
            p.rankUp,
            p.chuumonbi,
            p.shimei,
            p.nyuukin,
            p.bikou,
            p.kanryou ? '完了' : '未'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "入金管理");
        XLSX.writeFile(wb, "入金管理エクスポート.xlsx");
    };

    // --- Derived Data: Filtered & Sorted ---
    const filteredPayments = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        return payments
            .filter(p => {
                const matchesGlobal = (
                    (p.shimei || '').toLowerCase().includes(lowerQuery) ||
                    (p.bikou || '').toLowerCase().includes(lowerQuery) ||
                    (p.touroku || '').toLowerCase().includes(lowerQuery)
                );

                const matchesColumns = (
                    (!filters.shiharaibi || (p.shiharaibi ? '済' : '未') === filters.shiharaibi) &&
                    (!filters.boxIdou || (p.boxIdou ? '済' : '未') === filters.boxIdou) &&
                    (!filters.touroku || (p.touroku || '').toLowerCase().includes(filters.touroku.toLowerCase())) &&
                    (!filters.shimei || (p.shimei || '').toLowerCase().includes(filters.shimei.toLowerCase())) &&
                    (!filters.nyuukin || (p.nyuukin || '').toString().includes(filters.nyuukin))
                );

                return matchesGlobal && matchesColumns;
            })
            .sort((a, b) => {
                if (!sortConfig.key) {
                    // Default Sort: ID Descending (Newest first)
                    return b.id - a.id;
                }
                const aVal = a[sortConfig.key] || '';
                const bVal = b[sortConfig.key] || '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
    }, [payments, searchQuery, filters, sortConfig]);

    const paginatedPayments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredPayments, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

    return (
        <div className="payment-management-container">
            <div className="background-bubbles">
                <div className="bubble"></div>
                <div className="bubble"></div>
                <div className="bubble"></div>
                <div className="bubble"></div>
                <div className="bubble"></div>
            </div>

            <header>
                <h1><i className="fa-solid fa-heart header-icon"></i> 入金管理システム (ローカル版)</h1>
            </header>

            <div className="file-operations glass-panel" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="primary-btn" onClick={() => alert('ローカル版のためシート連携は無効です。Supabase移行時に有効化されます。')}>
                        <i className="fa-solid fa-cloud"></i> クラウド同期 (準備中)
                    </button>
                    <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                        <i className="fa-solid fa-file-import"></i> インポート (CSV/Excel)
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportFile}
                        accept=".csv, .xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                    <button className="secondary-btn" onClick={handleExportExcel}>
                        <i className="fa-solid fa-file-export"></i> Excel保存
                    </button>
                </div>
                <div style={{ color: 'var(--text-color)', fontSize: '0.9em', opacity: 0.8 }}>
                    ※ データはブラウザにのみ保存されています
                </div>
            </div>

            <div className="controls-area">
                <div className="search-box">
                    <i className="fa-solid fa-search"></i>
                    <input
                        type="text"
                        placeholder="氏名や備考で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="table-container glass-panel">
                <table className="cute-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('shiharaibi')}>支払日入力</th>
                            <th onClick={() => handleSort('boxIdou')}>BOX移動</th>
                            <th onClick={() => handleSort('touroku')}>登録情報</th>
                            <th onClick={() => handleSort('soshikizu')}>組織図確認</th>
                            <th onClick={() => handleSort('rankUp')}>ランクアップ</th>
                            <th onClick={() => handleSort('chuumonbi')}>振込日</th>
                            <th onClick={() => handleSort('shimei')}>氏名</th>
                            <th onClick={() => handleSort('nyuukin')}>金額</th>
                            <th onClick={() => handleSort('bikou')}>備考</th>
                            <th style={{ textAlign: 'center' }}>完了</th>
                        </tr>
                        <tr className="filter-row">
                            <th>
                                <select className="filter-input" value={filters.shiharaibi} onChange={e => setFilters({ ...filters, shiharaibi: e.target.value })}>
                                    <option value="">すべて</option>
                                    <option value="済">済</option>
                                    <option value="未">未</option>
                                </select>
                            </th>
                            <th>
                                <select className="filter-input" value={filters.boxIdou} onChange={e => setFilters({ ...filters, boxIdou: e.target.value })}>
                                    <option value="">すべて</option>
                                    <option value="済">済</option>
                                    <option value="未">未</option>
                                </select>
                            </th>
                            <th><input className="filter-input" placeholder="検索" onChange={e => setFilters({ ...filters, touroku: e.target.value })} /></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th><input className="filter-input" placeholder="名前" onChange={e => setFilters({ ...filters, shimei: e.target.value })} /></th>
                            <th></th>
                            <th></th>
                            <th></th>
                        </tr>
                        <tr className="quick-add-row">
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.shiharaibi} onChange={e => setQuickAdd({ ...quickAdd, shiharaibi: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.boxIdou} onChange={e => setQuickAdd({ ...quickAdd, boxIdou: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td>
                                <select className="filter-input" value={quickAdd.touroku} onChange={e => setQuickAdd({ ...quickAdd, touroku: e.target.value })}>
                                    <option value=""></option>
                                    <option value="新規">新規</option>
                                    <option value="追加">追加</option>
                                    <option value="ランクアップ">ﾗﾝｸｱｯﾌﾟ</option>
                                </select>
                            </td>
                            <td>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.soshikizu} onChange={e => setQuickAdd({ ...quickAdd, soshikizu: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td>
                                <select className="filter-input" value={quickAdd.rankUp} onChange={e => setQuickAdd({ ...quickAdd, rankUp: e.target.value })}>
                                    <option value=""></option>
                                    <option value="登録">登録</option>
                                    <option value="3個ok">3個ok</option>
                                </select>
                            </td>
                            <td><input type="date" className="filter-input" value={quickAdd.chuumonbi} onChange={e => setQuickAdd({ ...quickAdd, chuumonbi: e.target.value })} /></td>
                            <td><input type="text" className="filter-input" placeholder="氏名" value={quickAdd.shimei} onChange={e => setQuickAdd({ ...quickAdd, shimei: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td><input type="text" className="filter-input" placeholder="金額" value={quickAdd.nyuukin} onChange={e => setQuickAdd({ ...quickAdd, nyuukin: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td><input type="text" className="filter-input" placeholder="備考" value={quickAdd.bikou} onChange={e => setQuickAdd({ ...quickAdd, bikou: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td style={{ textAlign: 'center' }}>
                                <button className="primary-btn" style={{ padding: '2px 8px', fontSize: '0.7em' }} onClick={handleQuickAdd}>追加</button>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedPayments.map(p => (
                            <tr key={p.id} className={p.kanryou ? 'completed-row' : ''}>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-checkbox">
                                        <input type="checkbox" checked={p.shiharaibi} onChange={e => handleInlineEdit(p.id, 'shiharaibi', e.target.checked)} />
                                        <span className="checkmark"></span>
                                    </label>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-checkbox">
                                        <input type="checkbox" checked={p.boxIdou} onChange={e => handleInlineEdit(p.id, 'boxIdou', e.target.checked)} />
                                        <span className="checkmark"></span>
                                    </label>
                                </td>
                                <td>
                                    <select className="filter-input" value={p.touroku} onChange={e => handleInlineEdit(p.id, 'touroku', e.target.value)}>
                                        <option value=""></option>
                                        <option value="新規">新規</option>
                                        <option value="追加">追加</option>
                                        <option value="ランクアップ">ﾗﾝｸｱｯﾌﾟ</option>
                                    </select>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-checkbox">
                                        <input type="checkbox" checked={p.soshikizu} onChange={e => handleInlineEdit(p.id, 'soshikizu', e.target.checked)} />
                                        <span className="checkmark"></span>
                                    </label>
                                </td>
                                <td>{p.rankUp}</td>
                                <td>{p.chuumonbi}</td>
                                <td>
                                    <input
                                        type="text"
                                        className="filter-input"
                                        style={{ background: 'transparent', border: 'none', fontWeight: 'bold' }}
                                        value={p.shimei}
                                        onChange={e => handleInlineEdit(p.id, 'shimei', e.target.value)}
                                    />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <input
                                        type="text"
                                        className="filter-input"
                                        style={{ background: 'transparent', border: 'none', textAlign: 'right' }}
                                        value={Number(p.nyuukin || 0).toLocaleString()}
                                        onChange={e => handleInlineEdit(p.id, 'nyuukin', e.target.value.replace(/,/g, ''))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="filter-input"
                                        style={{ background: 'transparent', border: 'none' }}
                                        value={p.bikou}
                                        onChange={e => handleInlineEdit(p.id, 'bikou', e.target.value)}
                                    />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-heart-checkbox">
                                        <input type="checkbox" checked={p.kanryou} onChange={() => toggleKanryou(p.id)} />
                                        <i className="fa-solid fa-heart"></i>
                                    </label>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="pagination-controls glass-panel">
                    <button
                        className="glass-btn secondary"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                        <i className="fa-solid fa-chevron-left"></i> 前へ
                    </button>
                    <span className="page-info">
                        <strong>{currentPage}</strong> / {totalPages} ページ
                        <span className="total-count">({filteredPayments.length}件)</span>
                    </span>
                    <button
                        className="glass-btn secondary"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    >
                        次へ <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            )}
        </div>
    );
};

export default PaymentManagement;
