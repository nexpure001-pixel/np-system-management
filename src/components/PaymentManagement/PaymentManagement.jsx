import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import './PaymentManagement.css';

const PaymentManagement = () => {
    // --- State ---
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
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
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 100;
    const fileInputRef = useRef(null);

    // Quick Add State
    const [quickAdd, setQuickAdd] = useState({
        shiharaibi_nyuuryoku: false,
        box_idou: false,
        touroku_jouhou: '',
        soshikizu_kakunin: false,
        rank_up_bikou: '',
        chuumonbi: new Date().toISOString().split('T')[0],
        shimei: '',
        nyuukin_kingaku: '',
        bikou: ''
    });

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayments(data || []);
        } catch (err) {
            console.error('Failed to fetch payments:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, []);

    // --- Handlers ---
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
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

                const rows = jsonData.slice(1);
                const importedPayments = rows.map((row) => {
                    const valToString = (val) => {
                        if (val instanceof Date) return val.toISOString().split('T')[0];
                        return val !== undefined && val !== null ? String(val) : '';
                    };

                    const isChecked = (val) => val === '済' || val === true || val === 'TRUE' || val === '1' || val === 1;

                    return {
                        shiharaibi_nyuuryoku: isChecked(row[0]),
                        box_idou: isChecked(row[1]),
                        touroku_jouhou: valToString(row[2]),
                        soshikizu_kakunin: isChecked(row[3]),
                        rank_up_bikou: valToString(row[4]),
                        chuumonbi: valToString(row[5]) || null,
                        shimei: valToString(row[6]),
                        nyuukin_kingaku: row[7] ? Number(String(row[7]).replace(/[^\d.-]/g, '')) : 0,
                        bikou: valToString(row[8]),
                        kanryou: row[9] === '完了' || row[9] === '済' || isChecked(row[9])
                    };
                }).filter(p => p.shimei || p.nyuukin_kingaku);

                if (window.confirm(`${importedPayments.length}件のデータをインポート（クラウド保存）しますか？`)) {
                    setIsLoading(true);
                    const { error } = await supabase.from('payments').insert(importedPayments);
                    if (error) throw error;
                    alert('インポートが完了しました。');
                    fetchPayments();
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('インポートに失敗しました: ' + err.message);
            } finally {
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleQuickAdd = async () => {
        if (!quickAdd.shimei && !quickAdd.nyuukin_kingaku) return;

        try {
            const newRecord = {
                ...quickAdd,
                nyuukin_kingaku: quickAdd.nyuukin_kingaku.toString().replace(/,/g, '') || 0,
                chuumonbi: quickAdd.chuumonbi || null
            };

            const { error } = await supabase.from('payments').insert([newRecord]);
            if (error) throw error;

            fetchPayments();
            setQuickAdd(prev => ({
                ...prev,
                shiharaibi_nyuuryoku: false,
                box_idou: false,
                touroku_jouhou: '',
                soshikizu_kakunin: false,
                rank_up_bikou: '',
                shimei: '',
                nyuukin_kingaku: '',
                bikou: ''
            }));
        } catch (err) {
            alert('追加に失敗しました: ' + err.message);
        }
    };

    const toggleKanryou = async (id, currentStatus) => {
        try {
            const { error } = await supabase
                .from('payments')
                .update({ kanryou: !currentStatus })
                .eq('id', id);
            if (error) throw error;
            setPayments(payments.map(p => p.id === id ? { ...p, kanryou: !currentStatus } : p));
        } catch (err) {
            alert('更新に失敗しました');
        }
    };

    const handleInlineEdit = async (id, field, value) => {
        try {
            const finalValue = (field === 'chuumonbi' && value === '') ? null : value;
            const { error } = await supabase
                .from('payments')
                .update({ [field]: finalValue })
                .eq('id', id);
            if (error) throw error;
            setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
        } catch (err) {
            console.error('Inline edit error:', err);
        }
    };

    const handleExportExcel = () => {
        const header = ["支払日入力", "BOX移動", "登録情報", "組織図確認", "ランクアップ", "振込日", "氏名", "入金金額", "備考", "完了"];
        const data = payments.map(p => [
            p.shiharaibi_nyuuryoku ? '済' : '未',
            p.box_idou ? '済' : '未',
            p.touroku_jouhou,
            p.soshikizu_kakunin ? '済' : '未',
            p.rank_up_bikou,
            p.chuumonbi,
            p.shimei,
            p.nyuukin_kingaku,
            p.bikou,
            p.kanryou ? '完了' : '未'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "入金管理");
        XLSX.writeFile(wb, `入金管理_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // --- Derived Data: Filtered & Sorted ---
    const filteredPayments = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        return payments
            .filter(p => {
                const matchesGlobal = (
                    (p.shimei || '').toLowerCase().includes(lowerQuery) ||
                    (p.bikou || '').toLowerCase().includes(lowerQuery) ||
                    (p.touroku_jouhou || '').toLowerCase().includes(lowerQuery)
                );

                const matchesColumns = (
                    (!filters.shiharaibi || (p.shiharaibi_nyuuryoku ? '済' : '未') === filters.shiharaibi) &&
                    (!filters.boxIdou || (p.box_idou ? '済' : '未') === filters.boxIdou) &&
                    (!filters.touroku || (p.touroku_jouhou || '').toLowerCase().includes(filters.touroku.toLowerCase())) &&
                    (!filters.shimei || (p.shimei || '').toLowerCase().includes(filters.shimei.toLowerCase())) &&
                    (!filters.nyuukin || (p.nyuukin_kingaku || '').toString().includes(filters.nyuukin))
                );

                return matchesGlobal && matchesColumns;
            })
            .sort((a, b) => {
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
                <h1><i className="fa-solid fa-cloud header-icon"></i> 入金管理システム (クラウド同期版)</h1>
            </header>

            <div className="file-operations glass-panel" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                        <i className="fa-solid fa-file-import"></i> インポート (Excel/CSV)
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportFile}
                        accept=".csv, .xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                    <button className="secondary-btn" onClick={handleExportExcel}>
                        <i className="fa-solid fa-file-export"></i> Excel書き出し
                    </button>
                </div>
                <div style={{ color: 'var(--text-color)', fontSize: '0.9em', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-dot ${!isLoading ? 'online' : 'loading'}`}></span>
                    {isLoading ? '同期中...' : 'クラウド保存済み'}
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
                            <th onClick={() => setSortConfig({ key: 'shiharaibi_nyuuryoku', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>支払日入力</th>
                            <th onClick={() => setSortConfig({ key: 'box_idou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>BOX移動</th>
                            <th onClick={() => setSortConfig({ key: 'touroku_jouhou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>登録情報</th>
                            <th onClick={() => setSortConfig({ key: 'soshikizu_kakunin', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>組織図確認</th>
                            <th onClick={() => setSortConfig({ key: 'rank_up_bikou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>ランクアップ</th>
                            <th onClick={() => setSortConfig({ key: 'chuumonbi', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>振込日</th>
                            <th onClick={() => setSortConfig({ key: 'shimei', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>氏名</th>
                            <th onClick={() => setSortConfig({ key: 'nyuukin_kingaku', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>金額</th>
                            <th onClick={() => setSortConfig({ key: 'bikou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>備考</th>
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
                            <th><input className="filter-input" placeholder="検索" value={filters.touroku} onChange={e => setFilters({ ...filters, touroku: e.target.value })} /></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th><input className="filter-input" placeholder="名前" value={filters.shimei} onChange={e => setFilters({ ...filters, shimei: e.target.value })} /></th>
                            <th><input className="filter-input" placeholder="金額" value={filters.nyuukin} onChange={e => setFilters({ ...filters, nyuukin: e.target.value })} /></th>
                            <th></th>
                            <th></th>
                        </tr>
                        <tr className="quick-add-row">
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.shiharaibi_nyuuryoku} onChange={e => setQuickAdd({ ...quickAdd, shiharaibi_nyuuryoku: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.box_idou} onChange={e => setQuickAdd({ ...quickAdd, box_idou: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td>
                                <select className="filter-input" value={quickAdd.touroku_jouhou} onChange={e => setQuickAdd({ ...quickAdd, touroku_jouhou: e.target.value })}>
                                    <option value=""></option>
                                    <option value="新規">新規</option>
                                    <option value="追加">追加</option>
                                    <option value="ランクアップ">ﾗﾝｸｱｯﾌﾟ</option>
                                </select>
                            </td>
                            <td>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.soshikizu_kakunin} onChange={e => setQuickAdd({ ...quickAdd, soshikizu_kakunin: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td>
                                <select className="filter-input" value={quickAdd.rank_up_bikou} onChange={e => setQuickAdd({ ...quickAdd, rank_up_bikou: e.target.value })}>
                                    <option value=""></option>
                                    <option value="登録">登録</option>
                                    <option value="3個ok">3個ok</option>
                                </select>
                            </td>
                            <td><input type="date" className="filter-input" value={quickAdd.chuumonbi || ''} onChange={e => setQuickAdd({ ...quickAdd, chuumonbi: e.target.value })} /></td>
                            <td><input type="text" className="filter-input" placeholder="氏名" value={quickAdd.shimei} onChange={e => setQuickAdd({ ...quickAdd, shimei: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td><input type="text" className="filter-input" placeholder="金額" value={quickAdd.nyuukin_kingaku} onChange={e => setQuickAdd({ ...quickAdd, nyuukin_kingaku: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td><input type="text" className="filter-input" placeholder="備考" value={quickAdd.bikou} onChange={e => setQuickAdd({ ...quickAdd, bikou: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td style={{ textAlign: 'center' }}>
                                <button className="primary-btn" style={{ padding: '2px 8px', fontSize: '0.7em' }} onClick={handleQuickAdd} disabled={isLoading}>追加</button>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedPayments.map(p => (
                            <tr key={p.id} className={p.kanryou ? 'completed-row' : ''}>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-checkbox">
                                        <input type="checkbox" checked={p.shiharaibi_nyuuryoku} onChange={e => handleInlineEdit(p.id, 'shiharaibi_nyuuryoku', e.target.checked)} />
                                        <span className="checkmark"></span>
                                    </label>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-checkbox">
                                        <input type="checkbox" checked={p.box_idou} onChange={e => handleInlineEdit(p.id, 'box_idou', e.target.checked)} />
                                        <span className="checkmark"></span>
                                    </label>
                                </td>
                                <td>
                                    <select className="filter-input" value={p.touroku_jouhou || ''} onChange={e => handleInlineEdit(p.id, 'touroku_jouhou', e.target.value)}>
                                        <option value=""></option>
                                        <option value="新規">新規</option>
                                        <option value="追加">追加</option>
                                        <option value="ランクアップ">ﾗﾝｸｱｯﾌﾟ</option>
                                    </select>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-checkbox">
                                        <input type="checkbox" checked={p.soshikizu_kakunin} onChange={e => handleInlineEdit(p.id, 'soshikizu_kakunin', e.target.checked)} />
                                        <span className="checkmark"></span>
                                    </label>
                                </td>
                                <td>{p.rank_up_bikou}</td>
                                <td>{p.chuumonbi}</td>
                                <td>
                                    <input
                                        type="text"
                                        className="filter-input"
                                        style={{ background: 'transparent', border: 'none', fontWeight: 'bold' }}
                                        value={p.shimei || ''}
                                        onChange={e => handleInlineEdit(p.id, 'shimei', e.target.value)}
                                    />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <input
                                        type="text"
                                        className="filter-input"
                                        style={{ background: 'transparent', border: 'none', textAlign: 'right' }}
                                        value={Number(p.nyuukin_kingaku || 0).toLocaleString()}
                                        onChange={e => handleInlineEdit(p.id, 'nyuukin_kingaku', Number(e.target.value.replace(/,/g, '')))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="filter-input"
                                        style={{ background: 'transparent', border: 'none' }}
                                        value={p.bikou || ''}
                                        onChange={e => handleInlineEdit(p.id, 'bikou', e.target.value)}
                                    />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <label className="cute-heart-checkbox">
                                        <input type="checkbox" checked={p.kanryou} onChange={() => toggleKanryou(p.id, p.kanryou)} />
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
